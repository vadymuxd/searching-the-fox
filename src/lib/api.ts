import { JobSearchParams, JobSearchResponse, Job } from '@/types/job';
import { LogoService } from './logoService';
import { createClient } from '@/lib/supabase/client';
import { 
  createSearchRun, 
  updateSearchRunStatus, 
  SearchRunParameters 
} from '@/lib/db/searchRunService';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

export class JobService {
  // Helper method to get site label from site value
  static getSiteLabel(siteValue: string): string {
    const siteMap: Record<string, string> = {
      'linkedin': 'LinkedIn',
      'indeed': 'Indeed',
    };
    return siteMap[siteValue] || siteValue;
  }

  static async searchJobs(params: JobSearchParams, userId?: string, skipSearchRunCreation = false, parentRunId?: string): Promise<JobSearchResponse> {
    let searchRunId: string | undefined = parentRunId;
    
    try {
      // Create search run record if userId is provided and not skipped (for individual searches only)
      if (userId && !skipSearchRunCreation && !parentRunId) {
        const supabase = createClient();
        const searchRunParams: SearchRunParameters = {
          jobTitle: params.job_title,
          location: params.location,
          site: params.site,
          hours_old: parseInt(params.hours_old || '24'),
          results_wanted: params.results_wanted || 1000,
          country_indeed: params.site === 'indeed' ? 'UK' : params.country_indeed,
        };

        const searchRun = await createSearchRun(
          {
            userId,
            parameters: searchRunParams,
            source: 'manual',
            clientContext: {
              userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
              timestamp: new Date().toISOString(),
            },
          },
          supabase
        );

        if (searchRun) {
          searchRunId = searchRun.id;
          console.log('Created search run:', searchRunId);
        }
      }

      // Automatically set UK as default country for Indeed searches
      const countryIndeed = params.site === 'indeed' ? 'UK' : params.country_indeed;
      
      // Prepare the request body for POST request
      const requestBody = {
        search_term: params.job_title,
        location: params.location,
        site_name: [params.site], // FastAPI expects an array
        results_wanted: params.results_wanted || 1000,
        hours_old: parseInt(params.hours_old || '24'),
        country_indeed: countryIndeed || 'UK',
        run_id: searchRunId, // Pass the search run ID to Render
        user_id: userId, // Pass user ID so Render can save to database
      };

      const response = await fetch(`${API_BASE_URL}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        // Update search run to failed status if we have one
        if (searchRunId && userId) {
          const supabase = createClient();
          await updateSearchRunStatus(
            {
              runId: searchRunId,
              status: 'failed',
              error: `HTTP error! status: ${response.status}`,
            },
            supabase
          );
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Set source_site for all jobs based on the search parameters
      const jobsWithSourceSite = data.jobs ? data.jobs.map((job: Job) => ({
        ...job,
        source_site: this.getSiteLabel(params.site),
      })) : [];
      
      // Enhance company logos
      const enhancedJobs = await this.enhanceCompanyLogos(jobsWithSourceSite);
      
      // Update search run to success status with job count (only if we created a search run)
      if (searchRunId && userId && !skipSearchRunCreation) {
        const supabase = createClient();
        await updateSearchRunStatus(
          {
            runId: searchRunId,
            status: 'success',
            jobsFound: enhancedJobs.length,
          },
          supabase
        );
      }
      
      return {
        success: data.success,
        jobs: enhancedJobs,
        totalResults: data.total_results,
        jobCount: enhancedJobs?.length || 0,
      };
    } catch (error) {
      console.error('Job search error:', error);
      
      // Update search run to failed status if we have one (only if we created a search run)
      if (searchRunId && userId && !skipSearchRunCreation) {
        const supabase = createClient();
        await updateSearchRunStatus(
          {
            runId: searchRunId,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error occurred',
          },
          supabase
        );
      }
      
      return {
        success: false,
        jobs: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  static async searchAllJobBoards(
    params: Omit<JobSearchParams, 'site'>,
    onProgress?: (currentSite: string, completedSites: number, totalSites: number) => void,
    userId?: string
  ): Promise<JobSearchResponse> {
    let searchRunId: string | undefined;
    
    // Create ONE search run for "all job boards" search
    if (userId) {
      const supabase = createClient();
      const searchRunParams: SearchRunParameters = {
        jobTitle: params.job_title,
        location: params.location,
        site: 'all', // Mark as "all job boards"
        hours_old: parseInt(params.hours_old || '24'),
        results_wanted: params.results_wanted || 1000,
      };

      const searchRun = await createSearchRun(
        {
          userId,
          parameters: searchRunParams,
          source: 'manual',
          clientContext: {
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
            timestamp: new Date().toISOString(),
          },
        },
        supabase
      );

      if (searchRun) {
        searchRunId = searchRun.id;
        console.log('Created search run for all job boards:', searchRunId);
      }
    }
    
    const allJobs: Job[] = [];
    const errors: string[] = [];
    const totalSites = INDIVIDUAL_SITES.length;
    let completedSites = 0;

    // Update status to 'running' when we start
    if (searchRunId && userId) {
      const supabase = createClient();
      await updateSearchRunStatus(
        {
          runId: searchRunId,
          status: 'running',
        },
        supabase
      );
    }

    for (const site of INDIVIDUAL_SITES) {
      try {
        if (onProgress) {
          onProgress(site.label, completedSites, totalSites);
        }

        const siteParams: JobSearchParams = {
          ...params,
          site: site.value,
        };

        // Determine if this is the last site
        const isLastSite = completedSites === totalSites - 1;
        
        // Only pass run_id to the LAST site search so it updates the final status
        // This prevents multiple status updates and ensures status is updated even if user closes browser
        const response = await this.searchJobs(siteParams, userId, true, isLastSite ? searchRunId : undefined);
        
        if (response.success && response.jobs) {
          // Add site information to each job for identification
          const jobsWithSite = response.jobs.map(job => ({
            ...job,
            source_site: site.label,
          }));
          allJobs.push(...jobsWithSite);
        } else if (response.error) {
          errors.push(`${site.label}: ${response.error}`);
        }

        completedSites++;
        
        if (onProgress) {
          onProgress(site.label, completedSites, totalSites);
        }

        // Small delay between requests to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${site.label}: ${errorMessage}`);
        completedSites++;
        
        if (onProgress) {
          onProgress(site.label, completedSites, totalSites);
        }
      }
    }

    // Remove duplicates based on job title and company name with priority order
    const deduplicatedJobs = this.removeDuplicateJobs(allJobs);
    
    // Enhance company logos for better fallback
    const enhancedJobs = await this.enhanceCompanyLogos(deduplicatedJobs);

    // Note: Status update is handled by Render when the last site completes
    // This ensures status is updated even if user closes browser

    return {
      success: enhancedJobs.length > 0,
      jobs: enhancedJobs,
      totalResults: enhancedJobs.length,
      jobCount: enhancedJobs.length,
      error: errors.length > 0 ? `Some sites failed: ${errors.join('; ')}` : undefined,
    };
  }

  // Helper method to remove duplicate jobs with priority order
  static removeDuplicateJobs(jobs: Job[]): Job[] {
    // Priority order: LinkedIn > Indeed
    const sitePriority: Record<string, number> = {
      'LinkedIn': 1,
      'Indeed': 2,
    };

    // Create a map to track unique jobs by title + company combination
    const jobMap = new Map<string, Job>();

    jobs.forEach(job => {
      // Create a normalized key for comparison (lowercase, trimmed, remove extra spaces)
      const normalizeText = (text: string) => text.toLowerCase().trim().replace(/\s+/g, ' ');
      const key = `${normalizeText(job.title)}_${normalizeText(job.company)}`;
      
      const existingJob = jobMap.get(key);
      
      if (!existingJob) {
        // First time seeing this job
        jobMap.set(key, job);
      } else {
        // Job already exists, check priority
        const currentPriority = sitePriority[job.source_site || ''] || 999;
        const existingPriority = sitePriority[existingJob.source_site || ''] || 999;
        
        // Keep the job with higher priority (lower number = higher priority)
        if (currentPriority < existingPriority) {
          jobMap.set(key, job);
        }
      }
    });

    return Array.from(jobMap.values());
  }

  // Enhance company logos with better fallback URLs
  static async enhanceCompanyLogos(jobs: Job[]): Promise<Job[]> {
    return jobs.map(job => {
      // For Indeed jobs, clear any existing company_logo_url because Indeed
      // often sets it to Indeed's own logo instead of the company's logo
      if (job.source_site === 'Indeed') {
        job.company_logo_url = undefined;
      }
      
      // For jobs without a company logo URL, try to get one from our logo service
      if (!job.company_logo_url) {
        const logoUrls = LogoService.generateLogoUrls(job.company, undefined, job.source_site);
        // Use the first fallback URL as the primary URL
        job.company_logo_url = logoUrls[0];
      }
      
      return job;
    });
  }

  static async checkApiHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
      });
      return response.ok;
    } catch (error) {
      console.error('API health check failed:', error);
      return false;
    }
  }
}

// Site options for the search form
export const SITE_OPTIONS = [
  { value: 'all', label: 'All job boards' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'indeed', label: 'Indeed' },
] as const;

// Individual site options for sequential scraping
export const INDIVIDUAL_SITES = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'indeed', label: 'Indeed' },
] as const;
