# Local Development Setup

## Overview

This document explains how to test job searches locally without CORS issues.

## The Problem

When running the Next.js app locally (`localhost:3000`), direct API calls to the Render-hosted JobSpy API fail due to CORS restrictions. The Render API only allows requests from:
- `https://searching-the-fox.vercel.app` (production)
- Vercel preview deployments

## The Solution

We've implemented a **Next.js API proxy** that forwards requests from your local frontend to the Render API.

### How It Works

```
Local Frontend (localhost:3000)
    ↓
Next.js API Route (/api/proxy-scrape)
    ↓
Render JobSpy API (https://truelist-jobspy-api.onrender.com)
    ↓
Supabase Database
```

### Architecture

1. **Development Mode** (`npm run dev`):
   - Frontend calls `/api/proxy-scrape` (same-origin, no CORS issues)
   - Next.js proxy forwards to Render API
   - Render API processes search and saves to database

2. **Production Mode** (Vercel):
   - Frontend calls Render API directly
   - CORS is configured to allow Vercel domains
   - No proxy needed

## Files Created

### `/src/app/api/proxy-scrape/route.ts`
Next.js API route that proxies requests to Render. Only used in development.

### `/src/lib/api.ts` (Updated)
Automatically detects environment:
```typescript
const isLocalDev = process.env.NODE_ENV === 'development';
const API_BASE_URL = isLocalDev ? '/api/proxy-scrape' : RENDER_API_URL;
```

## Testing Locally

1. **Start your Next.js dev server:**
   ```bash
   npm run dev
   ```

2. **Navigate to** `http://localhost:3000`

3. **Perform a job search:**
   - The search will be proxied through `/api/proxy-scrape`
   - Render will process it and save to database
   - Your new `SearchRunning` component will monitor the status
   - Page will auto-refresh when complete

4. **Monitor the search:**
   - The global `SearchRunning` component appears in top-right
   - Shows elapsed time and status
   - Polls database every 3 seconds for updates
   - Auto-refreshes page when complete

## Troubleshooting

### "Failed to fetch" error
- Make sure `npm run dev` is running
- Check browser console for detailed error messages
- Verify Render API is healthy: https://truelist-jobspy-api.onrender.com/health

### Search appears stuck
- Render's free tier has cold starts (can take 50+ seconds on first request)
- The `SearchRunning` component will show elapsed time
- Database polling will detect when search completes

### No jobs appear after search
- Check Supabase logs for database write errors
- Verify your user is authenticated
- Check browser Network tab for API responses

## Environment Variables

### `.env.local` (Frontend)
```bash
NEXT_PUBLIC_API_URL=https://truelist-jobspy-api.onrender.com
```
Note: This is only used in production. In development, the proxy is used automatically.

### `jobspy-service/.env` (Render Service)
```bash
SUPABASE_URL=https://nwgusbtqxsakmukpniqo.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```
This allows Render to write directly to your Supabase database.

## Benefits of This Approach

✅ **No local Python service needed** - Render handles all job scraping  
✅ **No CORS issues** - Proxy eliminates cross-origin errors  
✅ **Same database** - Uses your production Supabase instance  
✅ **Real search runs** - Creates actual search_run records you can monitor  
✅ **Production-like testing** - Behavior matches deployed version  
✅ **Auto-detection** - Code automatically uses proxy in dev, direct in prod  

## Production Deployment

When deployed to Vercel:
- `NODE_ENV` is automatically set to `production`
- Frontend calls Render API directly (no proxy)
- CORS is configured to allow Vercel domains
- Everything works seamlessly
