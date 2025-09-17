# Vercel + Next.js Python Integration Options

## Option 1: Python Serverless Functions on Vercel ✅ (Best Choice)

### How it works:
```
Next.js Frontend (Vercel) 
└── Python API Functions (Vercel Serverless)
    ├── /api/scrape.py        # Your scraping logic
    └── /api/logos.py         # Your logo fetching
```

### Benefits:
- **No separate server needed**
- **Same deployment** (one git push)
- **Automatic scaling**
- **No additional hosting costs**
- **Keep your existing Python code**

### Vercel Python Support:
- ✅ Python 3.9+ runtime
- ✅ pip packages (including jobspy)
- ✅ Custom dependencies via requirements.txt
- ✅ Environment variables
- ✅ 10 second execution limit (perfect for job scraping)

### File Structure:
```
truelist-nextjs/
├── app/
│   └── page.tsx              # Next.js frontend
├── api/
│   ├── scrape.py            # Python scraping function
│   ├── logos.py             # Python logo fetching
│   └── requirements.txt     # Python dependencies
└── vercel.json              # Vercel config
```

### Example Implementation:

#### api/scrape.py (Vercel Function)
```python
from jobspy import scrape_jobs
from logo_fetcher import fetch_company_logos
from http.server import BaseHTTPRequestHandler
import json
import urllib.parse

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Parse query parameters
        query = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(query)
        
        site = params.get('site', [''])[0]
        location = params.get('location', [''])[0]
        job_title = params.get('job_title', [''])[0]
        
        # Your existing scraping logic
        jobs = scrape_jobs(
            site_name=site,
            search_term=job_title,
            location=location,
            results_wanted=50
        )
        
        # Your existing logo fetching
        jobs_with_logos = fetch_company_logos(jobs)
        
        # Return JSON response
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        
        response = {
            'success': True,
            'jobs': jobs_with_logos.to_dict('records')
        }
        
        self.wfile.write(json.dumps(response).encode())
```

#### vercel.json
```json
{
  "functions": {
    "api/*.py": {
      "runtime": "python3.9"
    }
  }
}
```

#### api/requirements.txt
```
python-jobspy==1.1.82
requests==2.32.5
beautifulsoup4==4.13.5
pandas==2.3.2
```

## Option 2: Keep FastAPI Separate (Also Good)

```
Next.js Frontend (Vercel) → FastAPI (Render/Railway)
```

### Benefits:
- **Keep existing code unchanged**
- **Familiar FastAPI structure**
- **More control over Python environment**

### Costs:
- **Render**: $7/month for Python hosting
- **Railway**: $5/month for Python hosting
- **Vercel**: Free for Next.js frontend

## Option 3: Hybrid Approach

```
Next.js (Vercel)
├── Simple endpoints → Python serverless functions
└── Complex scraping → External FastAPI server
```

## Recommendation: Option 1 (Python on Vercel)

### Why it's perfect for your use case:

1. **Your code fits perfectly**:
   - JobSpy scraping: ~2-5 seconds (well under 10s limit)
   - Logo fetching: ~1-3 seconds
   - Simple API responses

2. **Zero infrastructure management**:
   - No separate servers to maintain
   - No deployment coordination
   - No additional costs

3. **Vercel handles everything**:
   - Automatic scaling
   - Global CDN
   - Error monitoring
   - Logs and analytics

4. **Migration is straightforward**:
   - Move your `main.py` logic to `api/scrape.py`
   - Move your `logo_fetcher.py` to `api/logos.py`
   - Add `requirements.txt` with your dependencies
   - Deploy with `git push`

## Performance Comparison

| Approach | Cold Start | Scaling | Maintenance | Cost |
|----------|------------|---------|-------------|------|
| Vercel Python | ~1-2s | Automatic | Zero | $0 |
| Separate FastAPI | ~0.5s | Manual | Medium | $5-7/month |
| Hybrid | ~1-2s | Mixed | Low | $0-5/month |

## Answer: **NO separate server needed!** ✅

With Vercel's Python runtime, you can:
- Deploy everything together
- Keep your existing Python code (with minor adaptations)
- Get automatic scaling and global performance
- Pay nothing extra (Vercel Hobby is free)

Would you like me to show you exactly how to convert your current `main.py` and `logo_fetcher.py` into Vercel serverless functions? It's actually quite straightforward!
