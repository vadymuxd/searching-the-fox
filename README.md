# LinkedIn Job Scraper MVP

A simple web application that scrapes LinkedIn job postings based on job title and location. Built with Node.js, Express, and vanilla JavaScript.

## Features

- 🔍 Search jobs by title and location
- 📊 Display results in a clean, sortable table
- 📱 Responsive design that works on mobile and desktop
- ⚡ Fast scraping using LinkedIn's public API
- 🎨 Modern, beautiful UI with gradient backgrounds

## How It Works

This application uses LinkedIn's public job search API endpoint to fetch job postings. The scraper extracts:
- Job title
- Company name
- Location
- Date posted
- Direct link to the job posting

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Running the Application

1. Start the server:
   ```bash
   npm start
   ```
   
   Or for development with auto-restart:
   ```bash
   npm run dev
   ```

2. Open your browser and go to `http://localhost:3000`

3. Enter a job title and location, then click "Search Jobs"

4. View the results in a sortable table format

## Usage

### Search Page
- Enter the job title you're looking for (e.g., "Software Engineer", "Marketing Manager")
- Enter the location (e.g., "New York", "San Francisco", "Remote")
- Click "Search Jobs" to start scraping

### Results Page
- View job listings in a table with columns: Date Posted, Title, Location, Company, Actions
- Click on column headers to sort the results
- Click "View Job" to open the original LinkedIn posting
- Use "New Search" to go back and search for different criteria

## Technical Details

- **Backend**: Node.js with Express framework
- **Web Scraping**: Axios for HTTP requests, Cheerio for HTML parsing
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Styling**: Modern CSS with gradients, animations, and responsive design

## API Endpoints

- `GET /` - Main search page
- `GET /results` - Results display page
- `POST /api/scrape` - Scraping API endpoint
- `GET /health` - Health check endpoint

## Important Notes

- This tool is for educational purposes and personal use
- Be respectful of LinkedIn's terms of service and rate limits
- The scraper may need updates if LinkedIn changes their HTML structure
- Results are limited to what's available through LinkedIn's public job search

## Troubleshooting

If you encounter issues:

1. **No results found**: Try different search terms or more general location names
2. **Scraping errors**: LinkedIn may be blocking requests; try again after a few minutes
3. **Server won't start**: Make sure port 3000 is available or set a different PORT environment variable

## Development

The project structure:
```
├── server.js          # Main Express server
├── package.json       # Dependencies and scripts
├── public/
│   ├── index.html     # Search page
│   ├── results.html   # Results page
│   ├── styles.css     # Styling
│   ├── app.js         # Search page logic
│   └── results.js     # Results page logic
└── README.md         # This file
```

## License

MIT License - feel free to use and modify as needed. 