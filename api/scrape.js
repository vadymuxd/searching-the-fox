module.exports = async function handler(req, res) {
  // Add CORS headers for better compatibility
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Use dynamic imports to avoid bundling issues
    const axios = await import('axios');
    
    const { jobTitle, location, dateRange = '1', count = 100 } = req.body;
    console.log('API called with:', { jobTitle, location, dateRange, count });
    
    if (!jobTitle || !location) {
      res.status(400).json({ error: 'Job title and location are required' });
      return;
    }

    // Convert dateRange to hours for JobSpy API
    const dateRangeDays = parseInt(dateRange, 10);
    const hoursOld = dateRangeDays * 24; // Convert days to hours
    
    console.log('Date filtering setup:', { dateRangeDays, hoursOld });

    // Prepare JobSpy API request
    const jobspyPayload = {
      search_term: jobTitle,
      location: location,
      site_name: ["indeed", "linkedin", "zip_recruiter"], // Use multiple sites
      results_wanted: Math.min(count, 50), // Limit to reasonable number
      hours_old: hoursOld,
      country_indeed: "USA"
      // Note: Removed is_remote and job_type to avoid validation errors with null values
    };

    console.log('Calling JobSpy API with:', jobspyPayload);

    // Call JobSpy service
    const jobspyResponse = await axios.default.post(
      'http://localhost:8001/scrape',
      jobspyPayload,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60 seconds timeout for scraping
      }
    );

    if (!jobspyResponse.data.success) {
      throw new Error(jobspyResponse.data.error || 'JobSpy API returned error');
    }

    const jobs = jobspyResponse.data.jobs || [];
    console.log(`JobSpy returned ${jobs.length} jobs`);

    // Transform JobSpy response to match our frontend expectations
    const transformedJobs = jobs.map(job => ({
      title: job.title || 'No title',
      company: job.company || 'Unknown company',
      location: job.location || 'Unknown location',
      link: job.job_url || '',
      datePosted: job.date_posted || 'Date not available',
      logo: null, // JobSpy doesn't provide logos, could be added later
      site: job.site || 'unknown',
      salary: job.salary_min && job.salary_max 
        ? `$${job.salary_min} - $${job.salary_max}` 
        : job.salary_min 
          ? `$${job.salary_min}+` 
          : 'Salary not specified',
      description: job.description ? job.description.substring(0, 200) + '...' : null,
      jobType: job.job_type || null
    }));

    console.log(`Transformed ${transformedJobs.length} jobs for frontend`);

    // Apply additional filtering if needed (JobSpy should handle most filtering)
    const finalResults = transformedJobs.slice(0, count);

    res.status(200).json({
      success: true,
      data: finalResults,
      count: finalResults.length,
      debug: {
        dateRangeDays: dateRangeDays,
        hoursOld: hoursOld,
        originalDateRange: dateRange,
        timestamp: new Date().toISOString(),
        apiVersion: '3.0-jobspy',
        jobspyResults: jobs.length,
        finalCount: finalResults.length,
        sites: [...new Set(jobs.map(job => job.site))],
        note: 'Using JobSpy API for job scraping'
      },
      searchCriteria: {
        jobTitle,
        location,
        dateRange: dateRangeDays
      }
    });

  } catch (error) {
    console.error('Scrape API error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    
    // Check if it's a JobSpy service connection error
    if (error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
      res.status(503).json({ 
        success: false, 
        error: 'JobSpy service is not running. Please start the JobSpy API server on port 8001.',
        instructions: 'Run: cd jobspy-service && source jobspy-env/bin/activate && python main.py'
      });
      return;
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
