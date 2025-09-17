import { JobSearchParams, JobSearchResponse } from '@/types/job';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

export class JobService {
  static async searchJobs(params: JobSearchParams): Promise<JobSearchResponse> {
    try {
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
      };

      const response = await fetch(`${API_BASE_URL}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        success: data.success,
        jobs: data.jobs || [],
        totalResults: data.total_results,
        jobCount: data.jobs?.length || 0,
      };
    } catch (error) {
      console.error('Job search error:', error);
      return {
        success: false,
        jobs: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
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
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'indeed', label: 'Indeed' },
  { value: 'zip_recruiter', label: 'ZipRecruiter' },
  { value: 'glassdoor', label: 'Glassdoor' },
] as const;
