from fastapi import FastAPI, HTTPException
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
    increment_only: Optional[bool] = False  # If True, only increment jobs_found without changing status
    # Removed job_type and is_remote to avoid validation issues

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

@app.post("/scrape", response_model=JobSearchResponse)
async def scrape_jobs(request: JobSearchRequest):
    """
    Scrape jobs using JobSpy from multiple job sites
    """
    try:
        logger.info(f"Starting job scrape request: {request.model_dump()}")
        
        # Update search run status to 'running' if run_id is provided
        if request.run_id:
            update_search_run_status(request.run_id, "running")
        
        # Import jobspy here to avoid import issues
        try:
            from jobspy import scrape_jobs
        except ImportError as e:
            logger.error(f"Failed to import jobspy: {e}")
            # Update search run to failed if run_id is provided
            if request.run_id:
                update_search_run_status(request.run_id, "failed", error="JobSpy library not installed properly")
            raise HTTPException(status_code=500, detail="JobSpy library not installed properly")
        
        # Convert hours_old to date_posted parameter
        if request.hours_old:
            cutoff_date = datetime.now() - timedelta(hours=request.hours_old)
            date_posted = cutoff_date.strftime("%Y-%m-%d")
        else:
            date_posted = None
        
        logger.info(f"Scraping jobs with date filter: {date_posted}")
        
        # Call JobSpy
        jobs_df = scrape_jobs(
            site_name=request.site_name,
            search_term=request.search_term,
            location=request.location,
            results_wanted=request.results_wanted,
            hours_old=request.hours_old,
            country_indeed=request.country_indeed,
            is_remote=False  # Add this required parameter
        )
        
        if jobs_df is None or jobs_df.empty:
            logger.warning("No jobs found")
            # Update search run to success with 0 jobs if run_id is provided
            if request.run_id:
                update_search_run_status(request.run_id, "success", jobs_found=0)
            return JobSearchResponse(
                success=True,
                jobs=[],
                total_results=0,
                search_criteria=request.model_dump(),
                timestamp=datetime.now().isoformat()
            )
        
        logger.info(f"Found {len(jobs_df)} jobs")
        
        # Convert DataFrame to our response format
        jobs_list = []
        jobs_for_logo_fetch = []  # Prepare data for logo fetching
        
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
                'site': str(job.site) if hasattr(job, 'site') else "unknown"
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
            jobs_list.append(job_response)
        
        logger.info(f"Successfully processed {len(jobs_list)} jobs, starting logo fetch...")
        
        # Fetch company logos in parallel
        try:
            logo_urls = fetch_company_logos(jobs_for_logo_fetch, max_workers=10)
            
            # Add logo URLs to job responses
            for i, logo_url in enumerate(logo_urls):
                if i < len(jobs_list):
                    jobs_list[i].company_logo_url = logo_url
                    
            logger.info(f"Successfully fetched logos for {len(logo_urls)} jobs")
        except Exception as e:
            logger.warning(f"Error fetching logos: {e}")
            # Continue without logos if fetch fails
        
        logger.info(f"Successfully processed {len(jobs_list)} jobs")
        
        # Save jobs to database if user_id is provided (authenticated user)
        if request.user_id:
            try:
                logger.info(f"Saving jobs to database for user {request.user_id}")
                # Convert jobs_list (Pydantic models) to dicts for database insertion
                jobs_dict_list = [job.model_dump(mode='json') for job in jobs_list]
                saved_count = save_jobs_to_database(jobs_dict_list, request.user_id)
                logger.info(f"Successfully saved {saved_count} jobs to database")
                
                # Update search run with actual saved count
                if request.run_id:
                    logger.info(f"Updating search run {request.run_id}: increment_only={request.increment_only}, saved_count={saved_count}, jobs_list={len(jobs_list)}")
                    if request.increment_only:
                        # Just increment the count, don't change status (for multi-site searches)
                        # BUT: Also check if this might be the final update by looking at timing
                        update_search_run_status(request.run_id, "", jobs_found=saved_count, increment_only=True)
                    else:
                        # Final update with status change (last site in multi-site OR single site search)
                        # If we found jobs but saved 0, mark as failed with explanation
                        if len(jobs_list) > 0 and saved_count == 0:
                            update_search_run_status(
                                request.run_id, 
                                "failed", 
                                error=f"Found {len(jobs_list)} jobs but failed to save any to database. Check database logs for details.",
                                jobs_found=0
                            )
                        else:
                            update_search_run_status(request.run_id, "success", jobs_found=saved_count)
            except Exception as db_error:
                logger.error(f"Error saving jobs to database: {db_error}")
                # Mark as failed if database save completely failed
                if request.run_id:
                    if request.increment_only:
                        # For increment_only, just don't increment
                        pass
                    else:
                        update_search_run_status(
                            request.run_id, 
                            "failed", 
                            error=f"Database error: {str(db_error)}"
                        )
        else:
            # Guest user - just update search run if provided
            if request.run_id:
                update_search_run_status(request.run_id, "success", jobs_found=len(jobs_list))
        
        return JobSearchResponse(
            success=True,
            jobs=jobs_list,
            total_results=len(jobs_list),
            search_criteria=request.model_dump(),
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Error in scrape_jobs: {str(e)}", exc_info=True)
        # Update search run to failed if run_id is provided
        if request.run_id:
            update_search_run_status(request.run_id, "failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to scrape jobs: {str(e)}")

if __name__ == "__main__":
    logger.info("Starting JobSpy API server on port 8001")
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
