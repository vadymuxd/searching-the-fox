from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
import logging
from datetime import datetime, timedelta
import markdownify
from logo_fetcher import fetch_company_logos

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

app = FastAPI(title="JobSpy API", description="Job scraping service using JobSpy", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001", 
        "https://searching-the-fox.vercel.app",
        "https://*.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

class JobSearchRequest(BaseModel):
    search_term: str
    location: str
    site_name: Optional[List[str]] = ["indeed", "linkedin", "zip_recruiter", "glassdoor"]
    results_wanted: Optional[int] = 20
    hours_old: Optional[int] = 72  # hours old filter
    country_indeed: Optional[str] = "USA"
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

@app.post("/scrape", response_model=JobSearchResponse)
async def scrape_jobs(request: JobSearchRequest):
    """
    Scrape jobs using JobSpy from multiple job sites
    """
    try:
        logger.info(f"Starting job scrape request: {request.dict()}")
        
        # Import jobspy here to avoid import issues
        try:
            from jobspy import scrape_jobs
        except ImportError as e:
            logger.error(f"Failed to import jobspy: {e}")
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
            return JobSearchResponse(
                success=True,
                jobs=[],
                total_results=0,
                search_criteria=request.dict(),
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
                date_posted=str(job.date_posted) if hasattr(job, 'date_posted') and str(job.date_posted) != 'nan' else None,
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
        
        return JobSearchResponse(
            success=True,
            jobs=jobs_list,
            total_results=len(jobs_list),
            search_criteria=request.dict(),
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Error in scrape_jobs: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to scrape jobs: {str(e)}")

if __name__ == "__main__":
    logger.info("Starting JobSpy API server on port 8001")
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
