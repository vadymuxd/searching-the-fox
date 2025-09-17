# TrueList - Job Search Application

A modern job search application built with Next.js frontend and FastAPI backend.

## Architecture

- **Frontend**: Next.js with Mantine UI (deployed on Vercel)
- **Backend**: FastAPI with JobSpy integration (deployed on Render)

## Project Structure

```
/Truelist/
├── truelist-nextjs/           # Next.js frontend application
│   ├── src/
│   │   ├── app/              # Next.js app router pages
│   │   ├── components/       # React components
│   │   ├── lib/              # API utilities
│   │   └── types/            # TypeScript definitions
│   ├── public/               # Static assets
│   ├── package.json          # Frontend dependencies
│   └── vercel.json           # Vercel deployment config
├── jobspy-service/           # Python FastAPI backend
│   ├── main.py               # FastAPI server
│   ├── logo_fetcher.py       # Company logo fetching
│   ├── requirements.txt      # Python dependencies
│   └── jobspy-env/           # Python virtual environment
└── docs/                     # Project documentation
    ├── NEXTJS_ARCHITECTURE.md
    ├── TIMEOUT_ANALYSIS.md
    └── VERCEL_PYTHON_OPTIONS.md
```

## Development Setup

### Frontend (Next.js)
```bash
cd truelist-nextjs
npm install
npm run dev
```
Frontend will be available at http://localhost:3000

### Backend (FastAPI)
```bash
cd jobspy-service
source jobspy-env/bin/activate
python main.py
```
Backend API will be available at http://localhost:8001

## Deployment

- **Frontend**: Deploy `truelist-nextjs/` folder to Vercel
- **Backend**: Deploy `jobspy-service/` folder to Render

## Features

- Job search across multiple platforms (Indeed, LinkedIn, Glassdoor, ZipRecruiter)
- Real-time job scraping with JobSpy
- Company logo fetching
- Modern UI with Mantine components
- Responsive design
- Advanced filtering and sorting

## API Endpoints

- `GET /health` - Health check
- `POST /scrape` - Search jobs with parameters

## Environment Variables

### Frontend (Next.js)
- `NEXT_PUBLIC_API_URL` - FastAPI backend URL

### Backend (FastAPI)
- No additional environment variables required for basic setup

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