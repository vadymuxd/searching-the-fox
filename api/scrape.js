import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { jobTitle, location, count = 100 } = req.body;
  if (!jobTitle || !location) {
    res.status(400).json({ error: 'Job title and location are required' });
    return;
  }

  try {
    const allJobs = [];
    const jobsPerPage = 25;
    const pages = Math.ceil(count / jobsPerPage);

    for (let page = 0; page < pages; page++) {
      const start = page * jobsPerPage;
      const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(jobTitle)}&location=${encodeURIComponent(location)}&trk=public_jobs_jobs-search-bar_search-submit&start=${start}&count=${jobsPerPage}`;
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
      const $ = cheerio.load(response.data);
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
      if (!jobElements || jobElements.length === 0) continue;
      jobElements.each((index, element) => {
        const $element = $(element);
        let title = $element.find('h3 a span[title]').attr('title') ||
          $element.find('h3 a span').first().text().trim() ||
          $element.find('.base-search-card__title').text().trim() ||
          $element.find('h3').text().trim() ||
          $element.find('a[data-tracking-control-name="public_jobs_jserp-result_search-card"]').text().trim() ||
          $element.find('.job-title a').text().trim();
        let company = $element.find('h4 a span[title]').attr('title') ||
          $element.find('h4 a').text().trim() ||
          $element.find('.base-search-card__subtitle').text().trim() ||
          $element.find('.subline-level-1').text().trim() ||
          $element.find('h4').text().trim();
        let logo = $element.find('img[alt*="logo"], img[alt*="Logo"], img[alt*="company"], img[alt*="Company"]').attr('src') ||
          $element.find('.artdeco-entity-image').attr('src') ||
          $element.find('img[data-delayed-url]').attr('data-delayed-url') ||
          $element.find('img').first().attr('src') ||
          null;
        if (logo && !logo.startsWith('http')) {
          logo = `https://www.linkedin.com${logo}`;
        }
        let jobLocation = $element.find('.job-search-card__location').text().trim() ||
          $element.find('.subline-level-2').text().trim() ||
          $element.find('[data-test="job-location"]').text().trim() ||
          '';
        let link = $element.find('h3 a').attr('href') ||
          $element.find('.base-card__full-link').attr('href') ||
          $element.find('a[data-tracking-control-name="public_jobs_jserp-result_search-card"]').attr('href') ||
          $element.find('a').first().attr('href');
        let datePosted = $element.find('time').attr('datetime') ||
          $element.find('time').text().trim() ||
          $element.find('.job-search-card__listdate').text().trim() ||
          $element.find('[data-test="job-posted-date"]').text().trim() ||
          'Date not available';
        title = title ? title.replace(/\s+/g, ' ').trim() : '';
        company = company ? company.replace(/\s+/g, ' ').trim() : '';
        jobLocation = jobLocation ? jobLocation.replace(/\s+/g, ' ').trim() : '';
        if (title && title.length > 0) {
          allJobs.push({
            title,
            company: company || 'Company not specified',
            location: jobLocation || 'Location not specified',
            datePosted: datePosted || 'Date not available',
            link: link ? (link.startsWith('http') ? link : `https://www.linkedin.com${link}`) : null,
            logo: logo
          });
        }
      });
      if (page < pages - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    res.status(200).json({
      success: true,
      data: allJobs,
      count: allJobs.length,
      searchCriteria: {
        jobTitle,
        location
      }
    });
  } catch (error) {
    console.error('Scrape API error:', error); // Log error details to terminal
    res.status(500).json({ success: false, error: error.message });
  }
}
