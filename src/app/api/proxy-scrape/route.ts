import { NextRequest, NextResponse } from 'next/server';

const RENDER_API_URL = 'https://truelist-jobspy-api.onrender.com';

export async function POST(request: NextRequest) {
  let body: any;
  
  try {
    console.log('[Proxy] Received scrape request');
    
    // Get the request body
    body = await request.json();
    console.log('[Proxy] Request body:', {
      search_term: body.search_term,
      location: body.location,
      site_name: body.site_name,
      user_id: body.user_id ? '***' : undefined,
      run_id: body.run_id,
    });

    // Forward the request to Render with extended timeout
    // Note: Render free tier can take 50+ seconds to cold start
    // Vercel Hobby plan has 10s function timeout, so we use fire-and-forget approach
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for quick failure detection

    console.log('[Proxy] Forwarding to Render API...');
    const startTime = Date.now();
    
    // Fire-and-forget: Don't await Render response, let it work in background
    fetch(`${RENDER_API_URL}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
      .then(async (response) => {
        clearTimeout(timeoutId);
        const elapsed = Date.now() - startTime;
        console.log(`[Proxy] Render API responded in ${elapsed}ms with status ${response.status}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Proxy] Render API error:', response.status, errorText);
        } else {
          const data = await response.json();
          console.log('[Proxy] Render successfully processed request, jobs:', data.total_results);
        }
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        console.error('[Proxy] Render API error:', error);
        // Render will handle updating the search_run status on its end
      });

    // Return immediately to avoid Vercel timeout
    console.log('[Proxy] Request forwarded to Render, returning immediately');
    return NextResponse.json({ 
      success: true, 
      message: 'Search request forwarded to Render API. Status will update via database subscription.' 
    });
  } catch (error) {
    console.error('[Proxy] Error processing request:', error);
    return NextResponse.json(
      { error: 'Failed to forward request to Render API', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
