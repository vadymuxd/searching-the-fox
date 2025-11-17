from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
import logging
from datetime import datetime, timedelta
import markdownify
from logo_fetcher import fetch_company_logos
import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('api.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Initialize Supabase client (optional, only used if credentials are provided)
supabase: Optional[Client] = None
try:
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if supabase_url and supabase_service_key:
        supabase = create_client(supabase_url, supabase_service_key)
        logger.info("Supabase client initialized successfully")
    else:
        logger.warning("Supabase credentials not found - search run tracking disabled")
except Exception as e:
    logger.error(f"Failed to initialize Supabase client: {e}")
    supabase = None

app = FastAPI(title="JobSpy API", description="Job scraping service using JobSpy", version="1.0.0")

# Low-level ingress logging middleware to confirm ANY traffic reaches the server
@app.middleware("http")
async def ingress_logger(request: Request, call_next):
    try:
        logger.info(
            f"[INGRESS] method={request.method} path={request.url.path} origin={request.headers.get('origin')} ua={request.headers.get('user-agent')} trace_id={request.headers.get('x-trace-id')} content_type={request.headers.get('content-type')}"
        )
    except Exception as e:
        logger.error(f"[INGRESS] failed to log request: {e}")
    response = await call_next(request)
    try:
        logger.info(
            f"[EGRESS] status={response.status_code} path={request.url.path} trace_id={request.headers.get('x-trace-id')}"
        )
    except Exception:
        pass
    return response

# Add CORS middleware (use explicit origins + regex for Vercel previews)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://searching-the-fox.vercel.app",
    ],
    allow_origin_regex=r"^https://[a-z0-9-]+\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class JobSearchRequest(BaseModel):
    search_term: str
    location: str
    site_name: Optional[List[str]] = ["indeed", "linkedin", "zip_recruiter", "glassdoor"]
    results_wanted: Optional[int] = 20
    hours_old: Optional[int] = 72  # hours old filter
    country_indeed: Optional[str] = "USA"
    run_id: Optional[str] = None  # Optional search run ID for tracking
    user_id: Optional[str] = None  # Optional user ID for direct database writes
    # Removed increment_only - backend now handles all sites internally

class JobResponse(BaseModel):
    site: str
    title: str
    company: str
    location: str
    job_url: str
    date_posted: Optional[str] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    salary_currency: Optional[str] = None
    description: Optional[str] = None
    job_type: Optional[str] = None
    emails: Optional[List[str]] = None
    company_logo_url: Optional[str] = None

class JobSearchResponse(BaseModel):
    success: bool
    jobs: List[JobResponse]
    total_results: int
    search_criteria: dict
    timestamp: str

@app.get("/")
async def root():
    return {
        "message": "JobSpy API is running",
        "docs": "/docs",
        "version": "1.0.0",
        "endpoints": ["/scrape", "/health"]
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.post("/worker/poll-queue")
async def poll_queue(batch_size: int = 5):
    """
    Poll the search_runs table for pending runs and process them sequentially.
    Idempotency: uses a conditional status transition pending->running to claim a run.
    """
    if not supabase:
        return {"error": "Database not configured"}

    try:
        # Fetch oldest pending runs
        result = supabase.table("search_runs") \
            .select("id, user_id, parameters, status") \
            .eq("status", "pending") \
            .order("created_at", desc=False) \
            .limit(batch_size) \
            .execute()

        runs = result.data or []
        if not runs:
            return {"success": True, "processed": 0, "details": []}

        processed = 0
        details = []

        # Process runs one by one to limit memory and avoid timeouts
        for run in runs:
            run_id = run.get("id")
            user_id = run.get("user_id")
            params = run.get("parameters") or {}

            # Double-check and atomically transition to running only if still pending
            try:
                now_iso = datetime.now().isoformat()
                claim_res = supabase.table("search_runs") \
                    .update({"status": "running", "started_at": now_iso}) \
                    .eq("id", run_id) \
                    .eq("status", "pending") \
                    .execute()

                # If nothing was updated, someone else grabbed it
                if not claim_res.data:
                    details.append({"run_id": run_id, "skipped": True, "reason": "already claimed"})
                    continue
            except Exception as e:
                logger.error(f"Failed to claim run {run_id}: {e}")
                details.append({"run_id": run_id, "skipped": True, "reason": "claim_failed"})
                continue

            # Map stored parameters to JobSearchRequest
            try:
                site = params.get("site", "indeed")
                # Support "all" to request multiple boards in one scrape
                if site == "all":
                    site_name = ["linkedin", "indeed"]
                else:
                    site_name = [site]

                request_model = JobSearchRequest(
                    search_term=params.get("jobTitle", ""),
                    location=params.get("location", ""),
                    site_name=site_name,
                    results_wanted=int(params.get("results_wanted") or 1000),
                    hours_old=int(params.get("hours_old") or 24),
                    country_indeed=params.get("country_indeed") or "UK",
                    run_id=run_id,
                    user_id=user_id
                )

                # Reuse the existing scraping implementation to ensure consistent behavior
                resp = await scrape_jobs(request_model)
                processed += 1
                details.append({
                    "run_id": run_id,
                    "status": "completed",
                    "jobs": resp.total_results if hasattr(resp, "total_results") else None
                })
            except Exception as e:
                logger.error(f"Queue processing failed for {run_id}: {e}")
                # Finalize as failed; scrape_jobs already attempts to finalize on errors, but be safe
                try:
                    update_search_run_status(run_id, "failed", error=str(e))
                except Exception:
                    pass
                details.append({"run_id": run_id, "status": "failed", "error": str(e)})

        return {"success": True, "processed": processed, "details": details}
    except Exception as e:
        logger.error(f"Error polling queue: {e}")
        return {"error": str(e)}

@app.post("/cleanup-stuck-searches")
async def cleanup_stuck_searches():
    """
    Mark searches that have been 'running' for more than 5 minutes as 'failed'
    This handles cases where Render times out the HTTP request but the search_run status wasn't updated
    """
    if not supabase:
        return {"error": "Database not configured"}
    
    try:
        # Get all running searches older than 5 minutes
        five_minutes_ago = (datetime.now() - timedelta(minutes=5)).isoformat()
        
        result = supabase.table("search_runs")\
            .select("id, created_at")\
            .eq("status", "running")\
            .lt("created_at", five_minutes_ago)\
            .execute()
        
        stuck_searches = result.data if result.data else []
        
        # Update each stuck search to failed
        updated_count = 0
        for search in stuck_searches:
            update_search_run_status(
                search["id"], 
                "failed", 
                error="Request timed out - Render free tier has 30s HTTP timeout limit"
            )
            updated_count += 1
        
        logger.info(f"Cleaned up {updated_count} stuck searches")
        return {
            "success": True,
            "cleaned_up": updated_count,
            "searches": stuck_searches
        }
    except Exception as e:
        logger.error(f"Error cleaning up stuck searches: {e}")
        return {"error": str(e)}

# Explicit OPTIONS handler to ensure preflight responses are returned by the app
@app.options("/scrape")
async def options_scrape():
    # CORSMiddleware will attach the appropriate headers
    from fastapi.responses import Response
    return Response(status_code=204)

# Generic OPTIONS handler for debugging (catches other preflight paths)
@app.options("/{full_path:path}")
async def catch_all_options(full_path: str):
    from fastapi.responses import Response
    logger.info(f"[CORS-OPTIONS] path=/{full_path}")
    return Response(status_code=204)

def update_search_run_status(run_id: str, status: str, error: Optional[str] = None, jobs_found: Optional[int] = None, increment_only: bool = False):
    """
    Update the status of a search run in Supabase
    If jobs_found is provided, it will be ADDED to the existing count (cumulative)
    If increment_only is True, only update jobs_found without changing status (for multi-site searches)
    """
    if not supabase or not run_id:
        return
    
    try:
        update_data = {}
        
        # Only update status if not increment_only mode
        if not increment_only:
            update_data["status"] = status
            
            # Add timestamps based on status
            if status == "running":
                update_data["started_at"] = datetime.now().isoformat()
            elif status in ["success", "failed"]:
                update_data["completed_at"] = datetime.now().isoformat()
            
            # Add optional fields
            if error is not None:
                update_data["error_message"] = error
        
        # For jobs_found, we want to ADD to existing count, not replace it
        # This allows multiple searches (e.g., "all boards") to accumulate the total
        if jobs_found is not None:
            # First, get the current jobs_found value
            current = supabase.table("search_runs").select("jobs_found").eq("id", run_id).execute()
            current_count = current.data[0]["jobs_found"] if current.data and current.data[0]["jobs_found"] else 0
            update_data["jobs_found"] = current_count + jobs_found
            logger.info(f"Incrementing jobs_found from {current_count} to {update_data['jobs_found']}")
        
        if update_data:  # Only update if there's something to update
            result = supabase.table("search_runs").update(update_data).eq("id", run_id).execute()
            logger.info(f"Updated search run {run_id}{' (increment only)' if increment_only else f' to status: {status}'}")
            return result
        return None
    except Exception as e:
        logger.error(f"Failed to update search run {run_id}: {e}")
        return None

def save_job_to_database(job_data: dict, user_id: str):
    """
    Save a single job to the database and create user_jobs relationship
    Returns the job_id if successful, None otherwise
    """
    if not supabase:
        return None
    
    try:
        # Prepare date_posted - convert None to null, not string "None"
        date_posted = job_data.get("date_posted")
        if date_posted is None or date_posted == "None" or date_posted == "":
            date_posted = None  # Explicitly set to None (will be NULL in DB)
        
        # First, try to insert the job (will fail if job_url already exists due to UNIQUE constraint)
        job_insert_data = {
            "title": job_data.get("title", "No title"),
            "company": job_data.get("company", "Unknown"),
            "company_url": job_data.get("company_url"),
            "company_logo_url": job_data.get("company_logo_url"),
            "job_url": job_data["job_url"],  # Required field
            "location": job_data.get("location"),
            "is_remote": job_data.get("is_remote", False),
            "description": job_data.get("description"),
            "job_type": job_data.get("job_type"),
            "salary_min": job_data.get("salary_min"),
            "salary_max": job_data.get("salary_max"),
            "salary_currency": job_data.get("salary_currency"),
            "date_posted": date_posted,  # Use cleaned date
            "emails": job_data.get("emails"),
            "site": job_data.get("site", "unknown"),
            "source_site": job_data.get("source_site"),
        }
        
        # Try to insert the job
        job_result = supabase.table("jobs").insert(job_insert_data).execute()
        job_id = job_result.data[0]["id"] if job_result.data else None
        
        if job_id:
            logger.info(f"Inserted new job: {job_id}")
        
    except Exception as e:
        # Job might already exist (duplicate job_url), try to get it
        error_msg = str(e)
        if "duplicate" in error_msg.lower() or "unique" in error_msg.lower():
            try:
                # Get existing job by job_url
                existing_job = supabase.table("jobs").select("id").eq("job_url", job_data["job_url"]).execute()
                if existing_job.data:
                    job_id = existing_job.data[0]["id"]
                    logger.info(f"Job already exists: {job_id}")
                else:
                    logger.error(f"Could not find existing job: {job_data['job_url']}")
                    return None
            except Exception as get_error:
                logger.error(f"Error getting existing job: {get_error}")
                return None
        else:
            logger.error(f"Error inserting job: {e}")
            return None
    
    # Now create user_jobs relationship if we have a job_id
    if job_id and user_id:
        try:
            user_job_data = {
                "user_id": user_id,
                "job_id": job_id,
                "status": "new",
            }
            
            # Insert user_job relationship (might fail if already exists)
            supabase.table("user_jobs").insert(user_job_data).execute()
            logger.info(f"Created user_job relationship for user {user_id} and job {job_id}")
            
        except Exception as uj_error:
            # User might already have this job, which is fine
            error_msg = str(uj_error)
            if "duplicate" not in error_msg.lower() and "unique" not in error_msg.lower():
                logger.error(f"Error creating user_job relationship: {uj_error}")
    
    return job_id

def save_jobs_to_database(jobs_list: List[dict], user_id: str) -> int:
    """
    Save multiple jobs to database
    Returns count of successfully saved jobs
    """
    if not supabase or not user_id:
        return 0
    
    saved_count = 0
    for job in jobs_list:
        if save_job_to_database(job, user_id):
            saved_count += 1
    
    logger.info(f"Saved {saved_count} out of {len(jobs_list)} jobs to database for user {user_id}")
    return saved_count

def log_final_status(site_statuses: dict, total_jobs: int, increment_only: bool, run_id: Optional[str] = None):
    """
    Log a comprehensive summary of job board statuses and overall result
    Also updates the search_run status in database if run_id is provided
    """
    logger.info("=" * 80)
    logger.info("JOB SCRAPING SUMMARY")
    logger.info("=" * 80)
    
    # Count statuses - check if status string STARTS WITH "completed"
    completed_count = sum(1 for status in site_statuses.values() if status.startswith("completed"))
    failed_count = sum(1 for status in site_statuses.values() if "failed" in status)
    pending_count = sum(1 for status in site_statuses.values() if status == "pending")
    
    # Log each job board status
    for site, status in site_statuses.items():
        status_emoji = "✓" if status.startswith("completed") else "✗" if "failed" in status else "○"
        logger.info(f"  {status_emoji} {site.capitalize()}: {status}")
    
    # Determine overall status
    if completed_count == len(site_statuses):
        overall_status = "SUCCESS"
        db_status = "success"
    elif completed_count > 0:
        overall_status = "PARTIAL SUCCESS"
        db_status = "success"  # Still mark as success if we got some results
    else:
        overall_status = "FAILED"
        db_status = "failed"
    
    logger.info("-" * 80)
    logger.info(f"Overall Status: {overall_status}")
    logger.info(f"Job Boards: {completed_count} completed, {failed_count} failed, {pending_count} pending")
    logger.info(f"Total Jobs Found: {total_jobs}")
    logger.info(f"Increment Only Mode: {'Yes' if increment_only else 'No (Final Update)'}")
    logger.info("=" * 80)
    
    # Update database status based on overall result
    # This ensures every search run gets properly closed, regardless of increment_only
    if run_id and not increment_only:
        # Only update status if this is NOT an increment_only call
        # (increment_only calls should only update job counts, not finalize status)
        error_message = None
        if db_status == "failed":
            # Compile error messages from failed sites
            failed_sites = [f"{site}: {status}" for site, status in site_statuses.items() if "failed" in status]
            error_message = "; ".join(failed_sites)
        
        logger.info(f"[Database] Finalizing search_run {run_id} with status: {db_status}")
        update_search_run_status(run_id, db_status, error=error_message)
    elif run_id and increment_only:
        logger.info(f"[Database] Skipping status finalization for search_run {run_id} (increment_only mode)")
    
    return overall_status, db_status

@app.post("/scrape", response_model=JobSearchResponse)
async def scrape_jobs(request: JobSearchRequest):
    """
    Scrape jobs using JobSpy from multiple job sites
    Processes ALL requested job boards in a single API call
    Updates database with progress and final status
    Frontend should poll database for status updates
    """
    # Track status of each job board requested
    site_statuses = {}
    for site in request.site_name:
        site_statuses[site] = "pending"
    
    all_jobs_list = []  # Accumulate jobs from all sites
    
    try:
        logger.info(f"Starting job scrape request: {request.model_dump()}")
        logger.info(f"Job boards requested: {', '.join(request.site_name)}")
        
        # Update search run status to 'running' if run_id is provided
        if request.run_id:
            update_search_run_status(request.run_id, "running")
        
        # Import jobspy here to avoid import issues
        try:
            from jobspy import scrape_jobs
        except ImportError as e:
            logger.error(f"Failed to import jobspy: {e}")
            for site in request.site_name:
                site_statuses[site] = "failed: library error"
            # log_final_status will update the database status
            log_final_status(site_statuses, 0, False, request.run_id)
            raise HTTPException(status_code=500, detail="JobSpy library not installed properly")
        
        # Process each job board sequentially
        # This ensures all boards are processed even if user closes browser
        for i, site_name in enumerate(request.site_name):
            try:
                logger.info(f"[Site {i+1}/{len(request.site_name)}] Processing {site_name}...")
                site_statuses[site_name] = "processing"
                
                # Convert hours_old to date_posted parameter
                if request.hours_old:
                    cutoff_date = datetime.now() - timedelta(hours=request.hours_old)
                    date_posted = cutoff_date.strftime("%Y-%m-%d")
                else:
                    date_posted = None
                
                logger.info(f"[{site_name}] Scraping jobs with date filter: {date_posted}")
                
                # Call JobSpy for this specific site
                jobs_df = scrape_jobs(
                    site_name=[site_name],  # Single site at a time
                    search_term=request.search_term,
                    location=request.location,
                    results_wanted=request.results_wanted,
                    hours_old=request.hours_old,
                    country_indeed=request.country_indeed,
                    is_remote=False
                )
                
                if jobs_df is None or jobs_df.empty:
                    logger.warning(f"[{site_name}] No jobs found")
                    site_statuses[site_name] = "completed: 0 jobs"
                    continue
                
                logger.info(f"[{site_name}] Found {len(jobs_df)} jobs")
                
                # Convert DataFrame to our response format
                jobs_for_site = []
                jobs_for_logo_fetch = []
                
                for _, job in jobs_df.iterrows():
                    # Convert description from markdown to plain text if it exists
                    description = None
                    if hasattr(job, 'description') and job.description and str(job.description) != 'nan':
                        try:
                            # Convert markdown to plain text
                            description = markdownify.markdownify(str(job.description), strip=['a', 'img'])
                            # Limit description length
                            if len(description) > 500:
                                description = description[:497] + "..."
                        except Exception as e:
                            logger.warning(f"Failed to process description: {e}")
                            description = str(job.description)[:500] if str(job.description) != 'nan' else None
                    
                    # Handle salary information
                    salary_min = None
                    salary_max = None
                    salary_currency = None
                    
                    if hasattr(job, 'min_amount') and job.min_amount and str(job.min_amount) != 'nan':
                        try:
                            salary_min = float(job.min_amount)
                        except (ValueError, TypeError):
                            pass
                    
                    if hasattr(job, 'max_amount') and job.max_amount and str(job.max_amount) != 'nan':
                        try:
                            salary_max = float(job.max_amount)
                        except (ValueError, TypeError):
                            pass
                    
                    if hasattr(job, 'currency') and job.currency and str(job.currency) != 'nan':
                        salary_currency = str(job.currency)
                    
                    # Handle emails
                    emails = None
                    if hasattr(job, 'emails') and job.emails and str(job.emails) != 'nan':
                        try:
                            if isinstance(job.emails, str):
                                emails = [job.emails]
                            elif isinstance(job.emails, list):
                                emails = job.emails
                        except Exception:
                            pass
                    
                    # Prepare job data for logo fetching
                    job_data = {
                        'job_url': str(job.job_url) if hasattr(job, 'job_url') else "",
                        'company': str(job.company) if hasattr(job, 'company') and str(job.company) != 'nan' else "Unknown company",
                        'site': str(job.site) if hasattr(job, 'site') else site_name
                    }
                    jobs_for_logo_fetch.append(job_data)
                    
                    job_response = JobResponse(
                        site=job_data['site'],
                        title=str(job.title) if hasattr(job, 'title') else "No title",
                        company=job_data['company'],
                        location=str(job.location) if hasattr(job, 'location') and str(job.location) != 'nan' else "Unknown location",
                        job_url=job_data['job_url'],
                        date_posted=str(job.date_posted) if (hasattr(job, 'date_posted') and str(job.date_posted) != 'nan' and str(job.date_posted) != 'None') else None,
                        salary_min=salary_min,
                        salary_max=salary_max,
                        salary_currency=salary_currency,
                        description=description,
                        job_type=str(job.job_type) if hasattr(job, 'job_type') and str(job.job_type) != 'nan' else None,
                        emails=emails,
                        company_logo_url=None  # Will be filled after logo fetch
                    )
                    jobs_for_site.append(job_response)
                
                logger.info(f"[{site_name}] Successfully processed {len(jobs_for_site)} jobs, fetching logos...")
                
                # Fetch company logos for this site's jobs
                try:
                    logo_urls = fetch_company_logos(jobs_for_logo_fetch, max_workers=10)
                    for i, logo_url in enumerate(logo_urls):
                        if i < len(jobs_for_site):
                            jobs_for_site[i].company_logo_url = logo_url
                    logger.info(f"[{site_name}] Successfully fetched logos for {len(logo_urls)} jobs")
                except Exception as e:
                    logger.warning(f"[{site_name}] Error fetching logos: {e}")
                
                # Save jobs to database if user_id is provided
                if request.user_id and jobs_for_site:
                    try:
                        logger.info(f"[{site_name}] Saving {len(jobs_for_site)} jobs to database for user {request.user_id}")
                        jobs_dict_list = [job.model_dump(mode='json') for job in jobs_for_site]
                        saved_count = save_jobs_to_database(jobs_dict_list, request.user_id)
                        logger.info(f"[{site_name}] Successfully saved {saved_count}/{len(jobs_for_site)} jobs to database")
                        
                        # Update search run with cumulative count
                        if request.run_id:
                            update_search_run_status(request.run_id, "", jobs_found=saved_count, increment_only=True)
                        
                        if saved_count > 0:
                            site_statuses[site_name] = f"completed: {saved_count} jobs"
                        else:
                            site_statuses[site_name] = "completed: 0 saved (duplicates)"
                    except Exception as db_error:
                        logger.error(f"[{site_name}] Error saving jobs to database: {db_error}")
                        site_statuses[site_name] = f"failed: database error"
                else:
                    # No user_id or no jobs - just mark as completed
                    site_statuses[site_name] = f"completed: {len(jobs_for_site)} jobs"
                
                # Add this site's jobs to the overall list
                all_jobs_list.extend(jobs_for_site)
                
                logger.info(f"[{site_name}] ✓ Completed. Total jobs so far: {len(all_jobs_list)}")
                
            except Exception as site_error:
                logger.error(f"[{site_name}] Failed: {site_error}")
                site_statuses[site_name] = f"failed: {str(site_error)[:50]}"
                # Continue to next site even if this one failed
        
        # All sites processed - log final status and update database
        log_final_status(site_statuses, len(all_jobs_list), False, request.run_id)
        
        return JobSearchResponse(
            success=len(all_jobs_list) > 0,
            jobs=all_jobs_list,
            total_results=len(all_jobs_list),
            search_criteria=request.model_dump(),
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Error in scrape_jobs: {str(e)}", exc_info=True)
        # Mark all unprocessed sites as failed
        if 'site_statuses' in locals():
            for site in site_statuses:
                if site_statuses[site] == "pending" or site_statuses[site] == "processing":
                    site_statuses[site] = f"failed: {str(e)[:50]}"
            run_id = request.run_id if 'request' in locals() else None
            total_jobs = len(all_jobs_list) if 'all_jobs_list' in locals() else 0
            # log_final_status will update the database status
            log_final_status(site_statuses, total_jobs, False, run_id)
        raise HTTPException(status_code=500, detail=f"Failed to scrape jobs: {str(e)}")

if __name__ == "__main__":
    logger.info("Starting JobSpy API server on port 8001")
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
