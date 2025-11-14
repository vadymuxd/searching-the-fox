import { JobSearchParams, JobSearchResponse, Job } from '@/types/job';
import { LogoService } from './logoService';
import { createClient } from '@/lib/supabase/client';
import { 
  createSearchRun, 
  updateSearchRunStatus, 
  SearchRunParameters 
} from '@/lib/db/searchRunService';

// Direct call to Render API (CORS is configured on Render side)
const RENDER_API_URL = 'https://truelist-jobspy-api.onrender.com';

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
      const traceId = (globalThis.crypto && 'randomUUID' in globalThis.crypto) ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const requestBody = {
        search_term: params.job_title,
        location: params.location,
        site_name: [params.site], // FastAPI expects an array
        results_wanted: params.results_wanted || 1000,
        hours_old: parseInt(params.hours_old || '24'),
        country_indeed: countryIndeed || 'UK',
        run_id: searchRunId, // Pass the search run ID to Render
        user_id: userId, // Pass user ID so Render can save to database
        trace_id: traceId,
      };

      // Direct call to Render API
      const endpoint = `${RENDER_API_URL}/scrape`;
      
      // For authenticated users: fire-and-forget - just wake up Render and let it process
      // The search_run will be monitored via real-time subscriptions
      if (userId) {
        console.log('[API] Sending request to Render (fire-and-forget mode)...');
        // Send the request but don't wait for response
        fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Trace-Id': traceId,
          },
          body: JSON.stringify(requestBody),
          // @ts-ignore - keepalive ensures request is sent even when we don't await
          keepalive: true,
        }).catch((error) => {
          console.error('[API] Error sending request to Render:', error);
        });
        
        // Return immediately - frontend will monitor search_run status
        return {
          success: true,
          jobs: [],
          totalResults: 0,
          jobCount: 0,
        };
      }
      
      // For guest users: wait for full response (old behavior)
      const response = await fetch(endpoint, {
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
    
    try {
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

      // Prepare the request body with ALL job boards
      const sitesToSearch = INDIVIDUAL_SITES.map(s => s.value);
      
      const traceId = (globalThis.crypto && 'randomUUID' in globalThis.crypto) ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const requestBody = {
        search_term: params.job_title,
        location: params.location,
        site_name: sitesToSearch, // Pass ALL sites in a single request
        results_wanted: params.results_wanted || 1000,
        hours_old: parseInt(params.hours_old || '24'),
        country_indeed: 'UK',
        run_id: searchRunId,
        user_id: userId,
        trace_id: traceId,
      };

      console.log('[Multi-site] Making single API call with all sites:', sitesToSearch);

      // Direct call to Render API - backend will handle all sites
      const endpoint = `${RENDER_API_URL}/scrape`;
      
      // For authenticated users: fire-and-forget
      if (userId) {
        console.log('[Multi-site] Sending request to Render (fire-and-forget mode)...');
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Trace-Id': traceId },
          body: JSON.stringify(requestBody),
          // @ts-ignore
          keepalive: true,
        }).catch((error) => {
          console.error('[Multi-site] Error sending request to Render:', error);
        });
        
        // Return immediately
        return {
          success: true,
          jobs: [],
          totalResults: 0,
          jobCount: 0,
        };
      }
      
      // For guest users: wait for response
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Enhance company logos
      const enhancedJobs = await this.enhanceCompanyLogos(data.jobs || []);
      
      console.log(`[Multi-site] API completed. Jobs returned: ${enhancedJobs.length}`);

      return {
        success: data.success,
        jobs: enhancedJobs,
        totalResults: data.total_results,
        jobCount: enhancedJobs?.length || 0,
      };
    } catch (error) {
      console.error('[Multi-site] Search error:', error);
      
      // Update search run to failed status if we have one
      if (searchRunId && userId) {
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
      const response = await fetch(`${RENDER_API_URL}/health`, {
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
