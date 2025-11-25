export interface Job {
  id?: string;
  title: string;
  company: string;
  location: string;
  job_url: string;
  date_posted: string;
  salary?: string;
  interval?: string;
  min_amount?: number;
  max_amount?: number;
  currency?: string;
  // API actual fields
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  is_remote?: boolean;
  job_type?: string;
  company_logo_url?: string;
  description?: string;
  job_level?: string;
  company_industry?: string;
  company_url?: string;
  job_function?: string;
  benefits?: string;
  source_site?: string; // For tracking which job board the job came from
  created_at?: string; // From jobs table - used as fallback when date_posted is NULL
  
  // user_jobs fields (only present for authenticated users)
  user_job_id?: string;
  status?: 'new' | 'interested' | 'applied' | 'progressed' | 'rejected' | 'archived';
  notes?: string;
  user_created_at?: string;
  user_updated_at?: string;
}

export interface JobSearchParams {
  site: string;
  location: string;
  job_title: string;
  results_wanted?: number;
  hours_old?: string;
  country_indeed?: string;
}

export interface JobSearchResponse {
  success: boolean;
  jobs: Job[];
  totalResults?: number;
  jobCount?: number;
  error?: string;
}

export interface SearchFormData {
  jobTitle: string;
  location: string;
  site: string;
  resultsWanted: number;
  hoursOld: string;
}

export type SiteOption = {
  value: string;
  label: string;
};

export interface JobFilters {
  minSalary?: number;
  maxSalary?: number;
  jobType?: string;
  isRemote?: boolean;
  dateRange?: string;
}
