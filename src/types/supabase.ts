// Supabase Database Types
// This file will be auto-generated after creating tables in Stage 5
// For now, we define the types manually based on our schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type JobStatus = 'new' | 'interested' | 'applied' | 'progressed' | 'rejected' | 'archived'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          created_at: string
          updated_at: string
          preferences: Json
          metadata: Json
        }
        Insert: {
          id: string
          email: string
          created_at?: string
          updated_at?: string
          preferences?: Json
          metadata?: Json
        }
        Update: {
          id?: string
          email?: string
          created_at?: string
          updated_at?: string
          preferences?: Json
          metadata?: Json
        }
      }
      jobs: {
        Row: {
          id: string
          title: string
          company: string
          company_url: string | null
          company_logo_url: string | null
          job_url: string
          location: string | null
          location_country: string | null
          location_city: string | null
          location_state: string | null
          is_remote: boolean
          description: string | null
          job_type: string | null
          job_function: string | null
          job_level: string | null
          salary_interval: string | null
          salary_min: number | null
          salary_max: number | null
          salary_currency: string | null
          salary_source: string | null
          company_industry: string | null
          company_country: string | null
          company_addresses: string | null
          company_employees_label: string | null
          company_revenue_label: string | null
          company_description: string | null
          company_rating: number | null
          company_reviews_count: number | null
          date_posted: string | null
          emails: string[] | null
          skills: string[] | null
          experience_range: string | null
          vacancy_count: number | null
          work_from_home_type: string | null
          site: string
          source_site: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          company: string
          company_url?: string | null
          company_logo_url?: string | null
          job_url: string
          location?: string | null
          location_country?: string | null
          location_city?: string | null
          location_state?: string | null
          is_remote?: boolean
          description?: string | null
          job_type?: string | null
          job_function?: string | null
          job_level?: string | null
          salary_interval?: string | null
          salary_min?: number | null
          salary_max?: number | null
          salary_currency?: string | null
          salary_source?: string | null
          company_industry?: string | null
          company_country?: string | null
          company_addresses?: string | null
          company_employees_label?: string | null
          company_revenue_label?: string | null
          company_description?: string | null
          company_rating?: number | null
          company_reviews_count?: number | null
          date_posted?: string | null
          emails?: string[] | null
          skills?: string[] | null
          experience_range?: string | null
          vacancy_count?: number | null
          work_from_home_type?: string | null
          site: string
          source_site?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          company?: string
          company_url?: string | null
          company_logo_url?: string | null
          job_url?: string
          location?: string | null
          location_country?: string | null
          location_city?: string | null
          location_state?: string | null
          is_remote?: boolean
          description?: string | null
          job_type?: string | null
          job_function?: string | null
          job_level?: string | null
          salary_interval?: string | null
          salary_min?: number | null
          salary_max?: number | null
          salary_currency?: string | null
          salary_source?: string | null
          company_industry?: string | null
          company_country?: string | null
          company_addresses?: string | null
          company_employees_label?: string | null
          company_revenue_label?: string | null
          company_description?: string | null
          company_rating?: number | null
          company_reviews_count?: number | null
          date_posted?: string | null
          emails?: string[] | null
          skills?: string[] | null
          experience_range?: string | null
          vacancy_count?: number | null
          work_from_home_type?: string | null
          site?: string
          source_site?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_jobs: {
        Row: {
          id: string
          user_id: string
          job_id: string
          status: JobStatus
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          job_id: string
          status?: JobStatus
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          job_id?: string
          status?: JobStatus
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      job_status: JobStatus
    }
  }
}
