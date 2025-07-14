const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Serve the main input page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the results page
app.get('/results', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'results.html'));
});

// LinkedIn scraping function based on the article
async function scrapeLinkedInJobs(keywords, location, count = 100) {
    try {
        const allJobs = [];
        const jobsPerPage = 25; // LinkedIn typically returns max 25 jobs per page
        const pages = Math.ceil(count / jobsPerPage); // Calculate pages needed
        
        console.log(`Fetching ${count} jobs across ${pages} pages (${jobsPerPage} jobs per page)`);
        
        for (let page = 0; page < pages; page++) {
            const start = page * jobsPerPage;
            const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(keywords)}&location=${encodeURIComponent(location)}&trk=public_jobs_jobs-search-bar_search-submit&start=${start}&count=${jobsPerPage}`;
            
            console.log(`Scraping page ${page + 1}: ${url}`);
            
            const response = await axios.get(url, {
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
        
            console.log(`Response status: ${response.status}`);
            console.log(`Response data length: ${response.data.length}`);
            
            const $ = cheerio.load(response.data);
            
            // Debug: log the response to see the actual structure
            if (page === 0) {
                console.log('First 500 chars of response:', response.data.substring(0, 500));
            }
            
            // Try multiple selectors that LinkedIn might use
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
            
            let selectedSelector = null;
            let jobElements = null;
            
            for (const selector of possibleSelectors) {
                const elements = $(selector);
                if (page === 0) {
                    console.log(`Selector "${selector}" found ${elements.length} elements`);
                }
                if (elements.length > 0) {
                    selectedSelector = selector;
                    jobElements = elements;
                    break;
                }
            }
            
            if (!jobElements || jobElements.length === 0) {
                console.log(`No job elements found on page ${page + 1}`);
                continue;
            }
            
            if (page === 0) {
                console.log(`Using selector: ${selectedSelector}, found ${jobElements.length} elements`);
            }
            
            jobElements.each((index, element) => {
                const $element = $(element);
                
                // Try multiple selectors for job title
                let title = $element.find('h3 a span[title]').attr('title') ||
                           $element.find('h3 a span').first().text().trim() ||
                           $element.find('.base-search-card__title').text().trim() ||
                           $element.find('h3').text().trim() ||
                           $element.find('a[data-tracking-control-name="public_jobs_jserp-result_search-card"]').text().trim() ||
                           $element.find('.job-title a').text().trim();
                
                // Try multiple selectors for company
                let company = $element.find('h4 a span[title]').attr('title') ||
                             $element.find('h4 a').text().trim() ||
                             $element.find('.base-search-card__subtitle').text().trim() ||
                             $element.find('.subline-level-1').text().trim() ||
                             $element.find('h4').text().trim();
                
                // Try to extract company logo
                let logo = $element.find('img[alt*="logo"], img[alt*="Logo"], img[alt*="company"], img[alt*="Company"]').attr('src') ||
                          $element.find('.artdeco-entity-image').attr('src') ||
                          $element.find('img[data-delayed-url]').attr('data-delayed-url') ||
                          $element.find('img').first().attr('src') ||
                          null;
                
                // Clean up logo URL
                if (logo && !logo.startsWith('http')) {
                    logo = `https://www.linkedin.com${logo}`;
                }
                
                // Try multiple selectors for location
                let location = $element.find('.job-search-card__location').text().trim() ||
                              $element.find('.subline-level-2').text().trim() ||
                              $element.find('[data-test="job-location"]').text().trim() ||
                              '';
                
                // Try multiple selectors for link
                let link = $element.find('h3 a').attr('href') ||
                          $element.find('.base-card__full-link').attr('href') ||
                          $element.find('a[data-tracking-control-name="public_jobs_jserp-result_search-card"]').attr('href') ||
                          $element.find('a').first().attr('href');
                
                // Try multiple selectors for date
                let datePosted = $element.find('time').attr('datetime') ||
                                $element.find('time').text().trim() ||
                                $element.find('.job-search-card__listdate').text().trim() ||
                                $element.find('[data-test="job-posted-date"]').text().trim() ||
                                'Date not available';
                

                
                // Clean up the extracted data
                title = title ? title.replace(/\s+/g, ' ').trim() : '';
                company = company ? company.replace(/\s+/g, ' ').trim() : '';
                location = location ? location.replace(/\s+/g, ' ').trim() : '';
                
                // Log for debugging (only first page)
                if (page === 0 && index < 3) {
                    console.log(`Job ${index}:`, { title, company, location, link, datePosted });
                }
                
                if (title && title.length > 0) {
                    allJobs.push({
                        title,
                        company: company || 'Company not specified',
                        location: location || 'Location not specified',
                        datePosted: datePosted || 'Date not available',
                        link: link ? (link.startsWith('http') ? link : `https://www.linkedin.com${link}`) : null,
                        logo: logo
                    });
                }
            });
            
            const jobsFromThisPage = allJobs.length - (page > 0 ? page * 10 : 0); // Estimate based on typical 10 jobs per page we're seeing
            console.log(`Page ${page + 1} complete: found ${jobElements ? jobElements.length : 0} elements, added jobs to total (total so far: ${allJobs.length})`);
            
            // Add a small delay between requests to be respectful
            if (page < pages - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        console.log(`Successfully extracted ${allJobs.length} total jobs from ${pages} pages`);
        return allJobs;
    } catch (error) {
        console.error('Error scraping LinkedIn:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response headers:', error.response.headers);
        }
        throw new Error(`Failed to scrape LinkedIn jobs: ${error.message}`);
    }
}

// API endpoint to scrape jobs
app.post('/api/scrape', async (req, res) => {
    try {
        const { jobTitle, location, count = 100 } = req.body;
        
        if (!jobTitle || !location) {
            return res.status(400).json({ 
                error: 'Job title and location are required' 
            });
        }
        
        console.log(`Received request to scrape jobs: ${jobTitle} in ${location} (count: ${count})`);
        
        const jobs = await scrapeLinkedInJobs(jobTitle, location, count);
        
        res.json({
            success: true,
            data: jobs,
            count: jobs.length,
            searchCriteria: {
                jobTitle,
                location
            }
        });
        
    } catch (error) {
        console.error('Scraping error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('LinkedIn Job Scraper MVP is ready!');
}); 