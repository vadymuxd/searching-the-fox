'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { Job } from '@/types/job';

export default function EmailTemplatePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      // Redirect to home if not authenticated
      router.push('/');
      return;
    }

    if (user) {
      fetchEmailJobs(user.id);
    }
  }, [user, loading, router]);

  const fetchEmailJobs = async (userId: string) => {
    setLoadingJobs(true);
    setError(null);

    try {
      const response = await fetch(`/api/email-jobs?userId=${userId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch jobs');
      }

      setJobs(data.jobs || []);
    } catch (err) {
      console.error('Error fetching email jobs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setLoadingJobs(false);
    }
  };

  if (loading || loadingJobs) {
    return (
      <div style={{
        fontFamily: 'Arial, sans-serif',
        maxWidth: '600px',
        margin: '0 auto',
        padding: '20px',
        textAlign: 'center'
      }}>
        <p>Loading jobs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        fontFamily: 'Arial, sans-serif',
        maxWidth: '600px',
        margin: '0 auto',
        padding: '20px',
        textAlign: 'center',
        color: '#e03131'
      }}>
        <h2>Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      maxWidth: '600px',
      margin: '0 auto',
      padding: '20px',
      backgroundColor: '#f8f9fa'
    }}>
      {/* Logo Header with Link */}
      <div style={{
        backgroundColor: '#ffffff',
        padding: '20px',
        textAlign: 'center',
        borderRadius: '8px 8px 0 0'
      }}>
        <a 
          href="https://searching-the-fox.vercel.app/results"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            textDecoration: 'none',
            display: 'inline-block'
          }}
        >
          <img 
            src="/favicon.png"
            alt="Searching The Fox"
            style={{
              height: '60px',
              width: 'auto',
              marginBottom: '8px'
            }}
          />
        </a>
        <p style={{
          color: '#495057',
          margin: '0',
          fontSize: '14px'
        }}>
          {jobs.length} new job{jobs.length !== 1 ? 's' : ''} available
        </p>
      </div>

      {/* Jobs List */}
      <div style={{
        backgroundColor: '#ffffff',
        padding: '10px'
      }}>
        {jobs.length === 0 ? (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: '#868e96'
          }}>
            <p style={{ margin: 0 }}>No new jobs found.</p>
          </div>
        ) : (
          jobs.map((job, index) => (
            <div
              key={job.id || index}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e9ecef',
                borderRadius: '8px',
                padding: '20px',
                marginBottom: '15px',
                transition: 'box-shadow 0.2s'
              }}
            >
              {/* Company Info Row */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '12px'
              }}>
                {/* Company Logo */}
                {job.company_logo_url ? (
                  <img
                    src={job.company_logo_url}
                    alt={`${job.company} logo`}
                    style={{
                      width: '50px',
                      height: '50px',
                      objectFit: 'contain',
                      marginRight: '15px',
                      borderRadius: '6px',
                      border: '1px solid #e9ecef'
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '50px',
                      height: '50px',
                      backgroundColor: '#f1f3f5',
                      marginRight: '15px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                      fontWeight: 'bold',
                      color: '#adb5bd'
                    }}
                  >
                    {job.company.charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Company Name */}
                <div>
                  <h3 style={{
                    margin: '0 0 4px 0',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#212529'
                  }}>
                    {job.company}
                  </h3>
                  {job.location && (
                    <p style={{
                      margin: 0,
                      fontSize: '13px',
                      color: '#868e96'
                    }}>
                      📍 {job.location}
                    </p>
                  )}
                </div>
              </div>

              {/* Job Title */}
              <h2 style={{
                margin: '0 0 12px 0',
                fontSize: '20px',
                fontWeight: 'bold',
                color: '#1971c2',
                lineHeight: '1.3'
              }}>
                {job.title}
              </h2>

              {/* Job Details */}
              <div style={{
                marginBottom: '15px',
                fontSize: '14px',
                color: '#495057'
              }}>
                {job.job_type && (
                  <span style={{
                    display: 'inline-block',
                    backgroundColor: '#f1f3f5',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    marginRight: '8px',
                    fontSize: '12px',
                    textTransform: 'capitalize'
                  }}>
                    {job.job_type}
                  </span>
                )}
                {job.is_remote && (
                  <span style={{
                    display: 'inline-block',
                    backgroundColor: '#d0ebff',
                    color: '#1971c2',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    marginRight: '8px',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    Remote
                  </span>
                )}
                {job.salary_min && job.salary_max && (
                  <span style={{
                    display: 'inline-block',
                    color: '#2b8a3e',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}>
                    {job.salary_currency || '$'}{job.salary_min.toLocaleString()} - {job.salary_currency || '$'}{job.salary_max.toLocaleString()}
                  </span>
                )}
              </div>

              {/* Description Preview */}
              {job.description && (
                <p style={{
                  margin: '0 0 15px 0',
                  fontSize: '14px',
                  color: '#495057',
                  lineHeight: '1.5',
                  maxHeight: '60px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical'
                }}>
                  {job.description.replace(/<[^>]*>/g, '').substring(0, 200)}...
                </p>
              )}

              {/* View Job Button */}
              <a
                href={job.job_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  backgroundColor: '#228be6',
                  color: '#ffffff',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'background-color 0.2s'
                }}
              >
                View Job Post →
              </a>

              {/* Posted Date */}
              {job.date_posted && (
                <p style={{
                  margin: '12px 0 0 0',
                  fontSize: '12px',
                  color: '#868e96'
                }}>
                  Posted: {new Date(job.date_posted).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Email Footer */}
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '20px',
        textAlign: 'center',
        borderTop: '1px solid #e9ecef',
        borderRadius: '0 0 8px 8px'
      }}>
        <p style={{
          margin: '0 0 10px 0',
          fontSize: '13px',
          color: '#868e96'
        }}>
          You received this email because you have job alerts enabled.
        </p>
        <p style={{
          margin: 0,
          fontSize: '12px',
          color: '#adb5bd'
        }}>
          © 2025 Searching The Fox. All rights reserved.
        </p>
      </div>
    </div>
  );
}
