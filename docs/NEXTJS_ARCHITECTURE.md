# Next.js + Vercel Architecture for Searching The Fox

## Recommended Setup

### Frontend (Next.js)
- **Framework**: Next.js 14+ with App Router
- **UI Library**: Mantine (works perfectly with Next.js)
- **Styling**: Mantine + CSS Modules
- **Deployment**: Vercel (automatic)

### Backend Options

#### Option 1: Hybrid Approach (Recommended)
```
Next.js Frontend (Vercel)
├── API Routes (/api/scrape)
├── Python subprocess calls
└── JobSpy integration
```

#### Option 2: Microservices
```
Next.js Frontend (Vercel) → Python FastAPI (Railway/Render)
```

## Implementation Plan

### Phase 1: Next.js Setup
1. Create Next.js app with TypeScript
2. Install Mantine UI components
3. Create job search interface
4. Set up API routes

### Phase 2: Backend Integration
1. Move Python logic to Next.js API routes
2. Or keep FastAPI separate and call from Next.js
3. Implement logo fetching in API routes
4. Add caching and optimization

### Phase 3: Deployment
1. Deploy to Vercel
2. Configure environment variables
3. Set up custom domain
4. Monitor performance

## File Structure
```
searching-the-fox/
├── app/
│   ├── page.tsx                 # Home page
│   ├── search/
│   │   └── page.tsx            # Search results
│   └── api/
│       ├── scrape/
│       │   └── route.ts        # Job scraping API
│       └── logos/
│           └── route.ts        # Logo fetching API
├── components/
│   ├── JobCard.tsx
│   ├── SearchForm.tsx
│   └── JobTable.tsx
├── lib/
│   ├── jobspy.py              # Python integration
│   └── logo-fetcher.py        # Logo logic
└── public/
    └── assets/
```

## Benefits for Your Use Case

### 1. Vercel Advantages
- **Zero config deployment**: Just connect GitHub repo
- **Automatic HTTPS**: SSL certificates included
- **Global CDN**: Fast worldwide access
- **Environment variables**: Secure API key storage
- **Analytics**: Built-in performance monitoring

### 2. Next.js + Job Scraping
- **API Routes**: Handle scraping server-side
- **Streaming**: Show jobs as they're found (SSE)
- **Caching**: Cache job results for faster repeat searches
- **SEO**: Server-rendered job listings for Google indexing

### 3. Mantine Integration
- **TypeScript support**: Perfect Next.js integration
- **SSR compatibility**: Works with server rendering
- **Theme system**: Consistent design across pages
- **Component library**: Tables, forms, buttons, etc.

## Migration Strategy

### Keep Your Python Logic
Your existing `main.py` and `logo_fetcher.py` can be:
1. **Called as subprocess** from Next.js API routes
2. **Converted to API calls** if you keep FastAPI separate
3. **Rewritten in Node.js** (optional, but not necessary)

### Example Next.js API Route
```typescript
// app/api/scrape/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const site = searchParams.get('site');
  const location = searchParams.get('location');
  const jobTitle = searchParams.get('job_title');

  // Call your Python script
  const python = spawn('python', ['lib/scrape_jobs.py', site, location, jobTitle]);
  
  // Stream results back to frontend
  const jobs = await collectPythonOutput(python);
  
  return NextResponse.json({ jobs });
}
```

## Vercel Deployment Benefits

1. **GitHub Integration**: Auto-deploy on push
2. **Preview Deployments**: Test branches automatically
3. **Custom Domains**: Easy domain setup
4. **Environment Variables**: Secure config management
5. **Analytics**: Performance insights
6. **Edge Functions**: Global response speed

## Cost Considerations

- **Vercel Hobby**: Free tier (perfect for personal projects)
- **Vercel Pro**: $20/month (if you need more)
- **Python hosting**: Keep FastAPI separate on Railway ($5/month) or integrate into Next.js

## Recommendation

**Go with Next.js + Vercel!** Here's why:

1. **Perfect fit**: Vercel was built for Next.js
2. **Your Python code**: Can easily integrate or stay separate
3. **Mantine UI**: Works beautifully with Next.js
4. **Future-proof**: Modern stack with great community
5. **Deployment**: Incredibly simple and fast

Would you like me to start setting up the Next.js version of Searching The Fox? I can either:
1. **Create a new Next.js app** alongside your current code
2. **Show you exactly** how to migrate your existing functionality
3. **Keep your Python API** and just build Next.js frontend

What sounds best to you?
