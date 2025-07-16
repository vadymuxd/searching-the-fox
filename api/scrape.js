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
    const cheerio = await import('cheerio');
    
    const { jobTitle, location, dateRange = '1', count = 100 } = req.body;
    console.log('API called with:', { jobTitle, location, dateRange, count });
    
    if (!jobTitle || !location) {
      res.status(400).json({ error: 'Job title and location are required' });
      return;
    }

    // Convert dateRange to days for filtering
    const dateRangeDays = parseInt(dateRange, 10);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - dateRangeDays);
    
    console.log('Date filtering setup:', { dateRangeDays, cutoffDate: cutoffDate.toISOString() });

    // Function to parse LinkedIn date strings and check if they're within range
    function isWithinDateRange(dateString) {
      if (!dateString || dateString === 'Date not available') return false;
      
      try {
        const lowerDateString = dateString.toLowerCase().trim();
        
        // Handle "X hours ago", "X minutes ago", etc. - within 24 hours
        const hourMatch = lowerDateString.match(/(\d+)\s+hours?\s+ago/i);
        if (hourMatch) {
          const hoursAgo = parseInt(hourMatch[1], 10);
          return hoursAgo <= 24 && dateRangeDays >= 1;
        }
        
        if (lowerDateString.includes('minute') || lowerDateString.includes('second')) {
          return dateRangeDays >= 1; // Include for 1+ day filters
        }
        
        // Handle "X days ago"
        const dayMatch = lowerDateString.match(/(\d+)\s+days?\s+ago/i);
        if (dayMatch) {
          const daysAgo = parseInt(dayMatch[1], 10);
          return daysAgo <= dateRangeDays;
        }
        
        // Handle "X weeks ago"
        const weekMatch = lowerDateString.match(/(\d+)\s+weeks?\s+ago/i);
        if (weekMatch) {
          const weeksAgo = parseInt(weekMatch[1], 10);
          const daysAgo = weeksAgo * 7;
          return daysAgo <= dateRangeDays;
        }
        
        // Handle "X months ago"
        const monthMatch = lowerDateString.match(/(\d+)\s+months?\s+ago/i);
        if (monthMatch) {
          const monthsAgo = parseInt(monthMatch[1], 10);
          const daysAgo = monthsAgo * 30; // Approximate
          return daysAgo <= dateRangeDays;
        }
        
        // Handle text variations like "a day ago", "a week ago", etc.
        if (lowerDateString.includes('a day ago') || lowerDateString.includes('1 day ago')) {
          return dateRangeDays >= 1;
        }
        if (lowerDateString.includes('a week ago') || lowerDateString.includes('1 week ago')) {
          return dateRangeDays >= 7;
        }
        if (lowerDateString.includes('a month ago') || lowerDateString.includes('1 month ago')) {
          return dateRangeDays >= 30;
        }
        
        // Try to parse as ISO date or other standard formats
        const jobDate = new Date(dateString);
        if (!isNaN(jobDate.getTime())) {
          return jobDate >= cutoffDate;
        }
        
        // If we can't parse it, be restrictive for 24-hour filter, lenient for longer filters
        return dateRangeDays >= 7;
      } catch (e) {
        // If parsing fails, be restrictive for 24-hour filter
        return dateRangeDays >= 7;
      }
    }

    const allJobs = [];
    const jobsPerPage = 25;
    // Always scrape multiple pages to get more jobs for better frontend filtering
    const maxPages = Math.min(8, Math.ceil(count / jobsPerPage * 2)); // Scrape 2x more jobs than requested

    console.log(`Scraping up to ${maxPages} pages to get more jobs for frontend filtering`);
    
    let totalJobsScraped = 0;

    for (let page = 0; page < maxPages; page++) {
      const start = page * jobsPerPage;
      // REVERTED: Use the original seeMoreJobPostings endpoint that works on Vercel
      const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(jobTitle)}&location=${encodeURIComponent(location)}&trk=public_jobs_jobs-search-bar_search-submit&position=1&pageNum=0&start=${start}`;
      
      try {
        const response = await axios.default.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          timeout: 15000
        });

        const $ = cheerio.load(response.data);
        
        // REVERTED: Use HTML parsing with CSS selectors
        const possibleSelectors = [
          'li[data-occludable-job-id]',
          '.job-search-card',
          '.base-card',
          '.result-card',
          'li.result-card',
          'article',
          '.jobs-search__results-list li',
          '.job-card-container',
          'li'
        ];

        let jobElements = null;
        for (const selector of possibleSelectors) {
          const elements = $(selector);
          if (elements.length > 0) {
            jobElements = elements;
            break;
          }
        }

        if (!jobElements || jobElements.length === 0) {
          console.log(`No more jobs found on page ${page + 1}. Stopping pagination.`);
          break; // Exit loop if a page has no jobs
        }
        
        totalJobsScraped += jobElements.length;
        console.log(`Page ${page + 1}: Found ${jobElements.length} jobs. Total scraped so far: ${totalJobsScraped}`);

        jobElements.each((i, el) => {
          const jobTitleText = $(el).find('h3.base-search-card__title').text().trim() ||
            $(el).find('h3 a span[title]').attr('title') ||
            $(el).find('h3 a span').first().text().trim() ||
            $(el).find('.base-search-card__title').text().trim() ||
            $(el).find('h3').text().trim() ||
            $(el).find('a[data-tracking-control-name="public_jobs_jserp-result_search-card"]').text().trim() ||
            $(el).find('.job-title a').text().trim();

          let company = $(el).find('h4 a span[title]').attr('title') ||
            $(el).find('h4 a').text().trim() ||
            $(el).find('.base-search-card__subtitle').text().trim() ||
            $(el).find('.subline-level-1').text().trim() ||
            $(el).find('h4').text().trim();

          let logo = $(el).find('img[alt*="logo"], img[alt*="Logo"], img[alt*="company"], img[alt*="Company"]').attr('src') ||
            $(el).find('.artdeco-entity-image').attr('src') ||
            $(el).find('img[data-delayed-url]').attr('data-delayed-url') ||
            $(el).find('img').first().attr('src') ||
            null;

          if (logo && !logo.startsWith('http')) {
            logo = `https://www.linkedin.com${logo}`;
          }

          let jobLocation = $(el).find('.job-search-card__location').text().trim() ||
            $(el).find('.subline-level-2').text().trim() ||
            $(el).find('[data-test="job-location"]').text().trim() ||
            '';

          let link = $(el).find('h3 a').attr('href') ||
            $(el).find('.base-card__full-link').attr('href') ||
            $(el).find('a[data-tracking-control-name="public_jobs_jserp-result_search-card"]').attr('href') ||
            $(el).find('a').first().attr('href');

          let datePosted = $(el).find('time').attr('datetime') ||
            $(el).find('time').text().trim() ||
            $(el).find('.job-search-card__listdate').text().trim() ||
            $(el).find('[data-test="job-posted-date"]').text().trim() ||
            'Date not available';

          // Clean up the strings
          const cleanedTitle = jobTitleText ? jobTitleText.replace(/\s+/g, ' ').trim() : '';
          company = company ? company.replace(/\s+/g, ' ').trim() : '';
          jobLocation = jobLocation ? jobLocation.replace(/\s+/g, ' ').trim() : '';

          // Only add job if it has a title and a link
          if (cleanedTitle && link) {
            const jobData = {
              title: cleanedTitle,
              company,
              location: jobLocation,
              link,
              datePosted,
              logo
            };
            allJobs.push(jobData);
          }
        });

        // Add a small delay to avoid getting blocked
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        // If a single page fails (e.g., 404 or timeout), log the error and stop paginating.
        // This prevents the entire process from crashing.
        console.warn(`Failed to fetch page ${page + 1} at URL: ${url}`);
        console.warn(`Error: ${error.message}. Stopping pagination.`);
        break;
      }
    }

    console.log(`Finished scraping. Total jobs found: ${allJobs.length}`);
    console.log(`Final results: ${allJobs.length} jobs scraped (no date filtering in API)`);
    console.log(`Total jobs scraped: ${totalJobsScraped}`);
    console.log('Sample dates from results:', allJobs.slice(0, 5).map(job => ({ title: job.title, date: job.datePosted })));

    // Return all jobs - frontend will handle date filtering
    const finalResults = allJobs.slice(0, count * 2); // Return up to 2x requested for better filtering

    res.status(200).json({
      success: true,
      data: finalResults,
      count: finalResults.length,
      debug: {
        dateRangeDays: dateRangeDays,
        cutoffDate: cutoffDate.toISOString(),
        originalDateRange: dateRange,
        timestamp: new Date().toISOString(),
        apiVersion: '2.2', // Reverted to working method
        totalJobsScraped: totalJobsScraped,
        finalCount: finalResults.length,
        note: 'Date filtering moved to frontend'
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
    
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
