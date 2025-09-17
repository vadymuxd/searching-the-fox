import logging
from urllib.parse import urlparse
from typing import List, Dict, Optional
import re
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

logger = logging.getLogger(__name__)

class LogoFetcher:
    """
    Fast parallel logo fetching service that generates company logo URLs using known patterns.
    Uses ThreadPoolExecutor for parallel processing without needing async dependencies.
    """
    
    def __init__(self, max_workers: int = 20, timeout: int = 5):
        self.max_workers = max_workers
        self.timeout = timeout
    
    def get_linkedin_company_logo(self, job_url: str, company_name: str) -> Optional[str]:
        """
        Extract LinkedIn company logo by fetching the job page and parsing the actual logo URL.
        """
        try:
            if not job_url or 'linkedin.com/jobs/view/' not in job_url:
                return None
            
            # Fetch the LinkedIn job page
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            
            response = requests.get(job_url, headers=headers, timeout=self.timeout)
            if response.status_code != 200:
                return None
            
            # Look for company logo URL patterns in the HTML
            content = response.text
            
            # Pattern 1: Look for company logo in various formats
            logo_patterns = [
                r'https://media\.licdn\.com/dms/image/[^"\']+/company-logo_\d+_\d+/[^"\']+',
                r'https://media\.licdn\.com/dms/image/[^"\']+company-logo[^"\']+',
                r'"companyLogoUrl":"([^"]+)"',
                r'"logo":\s*"([^"]*https://media\.licdn\.com[^"]*)"'
            ]
            
            for pattern in logo_patterns:
                matches = re.findall(pattern, content)
                if matches:
                    logo_url = matches[0]
                    # Clean up the URL if it was captured in a group
                    if isinstance(logo_url, tuple):
                        logo_url = logo_url[0]
                    
                    # Ensure it's a valid logo URL
                    if 'company-logo' in logo_url and logo_url.startswith('https://'):
                        # Clean up HTML entities and escape characters
                        logo_url = logo_url.replace('\\', '').replace('&amp;', '&')
                        return logo_url
            
            return None
            
        except Exception as e:
            logger.warning(f"Error fetching LinkedIn company logo from {job_url}: {e}")
            return None
    
    def get_clearbit_logo(self, company_name: str, job_url: str = None) -> str:
        """
        Generate Clearbit logo URL - most reliable free logo service.
        """
        if not company_name:
            return None
        
        # Clean company name for domain
        clean_name = re.sub(r'[^\w\s-]', '', company_name.lower())
        clean_name = re.sub(r'\s+', '', clean_name.strip())
        
        # Try to extract domain from job URL if available
        if job_url:
            try:
                parsed_url = urlparse(job_url)
                if 'linkedin.com' in parsed_url.netloc:
                    # For LinkedIn jobs, try common domain patterns
                    common_domains = [
                        f"{clean_name}.com",
                        f"{clean_name}.io",
                        f"{clean_name}.net",
                    ]
                else:
                    # For other job sites, try to use the job site domain
                    domain_parts = parsed_url.netloc.split('.')
                    if len(domain_parts) >= 2:
                        main_domain = '.'.join(domain_parts[-2:])
                        return f"https://logo.clearbit.com/{main_domain}"
            except Exception:
                pass
        
        # Default to .com domain
        return f"https://logo.clearbit.com/{clean_name}.com"
    
    def get_logo_dev_url(self, company_name: str) -> str:
        """
        Generate Logo.dev URL as fallback.
        """
        if not company_name:
            return None
        
        clean_name = re.sub(r'[^\w\s-]', '', company_name.lower())
        clean_name = re.sub(r'\s+', '', clean_name.strip())
        return f"https://img.logo.dev/{clean_name}.com?token=pk_X9vSaQ0wR3WxKzsHQUfhOQ"
    
    def verify_logo_url(self, url: str) -> bool:
        """
        Quick verification if logo URL returns a valid image.
        """
        try:
            response = requests.head(url, timeout=self.timeout, allow_redirects=True)
            content_type = response.headers.get('content-type', '').lower()
            return response.status_code == 200 and 'image' in content_type
        except Exception:
            return False
    
    def get_logo_for_job(self, job_data: Dict) -> str:
        """
        Get the best available logo URL for a job.
        """
        job_url = job_data.get('job_url', '')
        company_name = job_data.get('company', '')
        site = job_data.get('site', '').lower()
        
        if not company_name:
            return None
        
        # Strategy 1: LinkedIn-specific extraction (highest priority)
        if 'linkedin' in site or 'linkedin.com' in job_url:
            linkedin_logo = self.get_linkedin_company_logo(job_url, company_name)
            if linkedin_logo:
                logger.info(f"Found LinkedIn logo for {company_name}: {linkedin_logo}")
                return linkedin_logo
        
        # Strategy 2: Clearbit (most reliable fallback)
        clearbit_url = self.get_clearbit_logo(company_name, job_url)
        if clearbit_url and self.verify_logo_url(clearbit_url):
            logger.info(f"Found Clearbit logo for {company_name}: {clearbit_url}")
            return clearbit_url
        
        # Strategy 3: Logo.dev as fallback
        logo_dev_url = self.get_logo_dev_url(company_name)
        if logo_dev_url:
            logger.info(f"Using Logo.dev for {company_name}: {logo_dev_url}")
            return logo_dev_url
        
        # Strategy 4: Return clearbit even if verification failed (may still work in browser)
        logger.info(f"Using unverified Clearbit for {company_name}: {clearbit_url}")
        return clearbit_url
    
    def fetch_logos_for_jobs(self, jobs: List[Dict]) -> List[str]:
        """
        Fetch logos for multiple jobs in parallel using ThreadPoolExecutor.
        """
        start_time = time.time()
        logger.info(f"Starting logo fetch for {len(jobs)} jobs with {self.max_workers} workers")
        
        logo_urls = []
        
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            # Submit all jobs
            future_to_job = {executor.submit(self.get_logo_for_job, job): job for job in jobs}
            
            # Collect results in order
            results = [None] * len(jobs)
            for future in as_completed(future_to_job):
                job = future_to_job[future]
                job_index = jobs.index(job)
                try:
                    logo_url = future.result()
                    results[job_index] = logo_url
                except Exception as e:
                    logger.warning(f"Error fetching logo for job {job_index}: {e}")
                    results[job_index] = self.get_clearbit_logo(job.get('company', ''))
        
        end_time = time.time()
        logger.info(f"Logo fetch completed in {end_time - start_time:.2f} seconds")
        
        return results

# Convenience function for easy usage
def fetch_company_logos(jobs: List[Dict], max_workers: int = 20) -> List[str]:
    """
    Convenience function to fetch company logos for a list of jobs.
    
    Args:
        jobs: List of job dictionaries with 'job_url', 'company', and 'site' fields
        max_workers: Maximum number of concurrent workers
    
    Returns:
        List of logo URLs corresponding to each job
    """
    fetcher = LogoFetcher(max_workers=max_workers)
    return fetcher.fetch_logos_for_jobs(jobs)
