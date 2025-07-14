export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Dynamic imports for serverless environment
        const axios = (await import('axios')).default;
        const cheerio = (await import('cheerio')).default;

        const { jobTitle, location, count = 100 } = req.body;

        if (!jobTitle || !location) {
            return res.status(400).json({ error: 'Job title and location are required' });
        }

        // Construct LinkedIn search URL with date filter for last 30 days
        const searchUrl = `https://www.linkedin.com/jobs/search?keywords=${encodeURIComponent(jobTitle)}&location=${encodeURIComponent(location)}&f_TPR=r2592000&start=0`;

        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const jobs = [];

        // Extract job listings
        $('.result-card').each((index, element) => {
            const $element = $(element);
            
            const title = $element.find('.result-card__title').text().trim();
            const company = $element.find('.result-card__subtitle').text().trim();
            const location = $element.find('.job-result-card__location').text().trim();
            const link = $element.find('.result-card__full-card-link').attr('href');
            const datePosted = $element.find('.job-result-card__listdate').text().trim();
            const logo = $element.find('.artdeco-entity-image').attr('src');

            if (title && company) {
                jobs.push({
                    title,
                    company,
                    location,
                    link,
                    datePosted: datePosted || new Date().toISOString().split('T')[0],
                    logo
                });
            }
        });

        // Alternative selector for job listings
        if (jobs.length === 0) {
            $('.job-search-card').each((index, element) => {
                const $element = $(element);
                
                const title = $element.find('.base-search-card__title').text().trim();
                const company = $element.find('.base-search-card__subtitle').text().trim();
                const location = $element.find('.job-search-card__location').text().trim();
                const link = $element.find('.base-card__full-link').attr('href');
                const datePosted = $element.find('.job-search-card__listdate').text().trim();
                const logo = $element.find('.search-entity-media img').attr('src');

                if (title && company) {
                    jobs.push({
                        title,
                        company,
                        location,
                        link,
                        datePosted: datePosted || new Date().toISOString().split('T')[0],
                        logo
                    });
                }
            });
        }

        // If still no jobs found, try another selector
        if (jobs.length === 0) {
            $('[data-entity-urn*="job"]').each((index, element) => {
                const $element = $(element);
                
                const title = $element.find('h3, .job-title, [data-test="job-title"]').first().text().trim();
                const company = $element.find('.company-name, [data-test="company-name"], .job-search-card__subtitle-link').first().text().trim();
                const location = $element.find('.job-location, [data-test="job-location"]').first().text().trim();
                const link = $element.find('a').first().attr('href');
                const datePosted = $element.find('.job-posted-date, [data-test="job-posted-date"]').first().text().trim();
                const logo = $element.find('img').first().attr('src');

                if (title && company) {
                    jobs.push({
                        title,
                        company,
                        location,
                        link: link ? (link.startsWith('http') ? link : `https://www.linkedin.com${link}`) : null,
                        datePosted: datePosted || new Date().toISOString().split('T')[0],
                        logo
                    });
                }
            });
        }

        // Limit results
        const limitedJobs = jobs.slice(0, parseInt(count));

        return res.status(200).json({
            success: true,
            data: limitedJobs,
            total: limitedJobs.length
        });

    } catch (error) {
        console.error('Scraping error:', error);
        return res.status(500).json({ 
            error: 'Failed to scrape job listings',
            details: error.message 
        });
    }
}
