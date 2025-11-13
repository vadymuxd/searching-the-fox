import { NextRequest, NextResponse } from 'next/server';

const RENDER_API_URL = 'https://truelist-jobspy-api.onrender.com';

export async function POST(request: NextRequest) {
  try {
    console.log('[Proxy] Received scrape request');
    
    // Get the request body
    const body = await request.json();
    console.log('[Proxy] Request body:', {
      search_term: body.search_term,
      location: body.location,
      site_name: body.site_name,
      user_id: body.user_id ? '***' : undefined,
      run_id: body.run_id,
    });

    // Forward the request to Render with extended timeout
    // Note: Render free tier can take 50+ seconds to cold start
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

    console.log('[Proxy] Forwarding to Render API...');
    const startTime = Date.now();
    
    const response = await fetch(`${RENDER_API_URL}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    const elapsed = Date.now() - startTime;
    console.log(`[Proxy] Render API responded in ${elapsed}ms with status ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Proxy] Render API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Render API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[Proxy] Successfully proxied request, returning', data.total_results, 'jobs');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Proxy] Error:', error);
    
    // Check if it's a timeout error
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { 
          error: 'Request timeout', 
          details: 'Render API took too long to respond. This often happens on cold starts (first request after inactivity). Please try again - it should be faster now.' 
        },
        { status: 504 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to proxy request to Render API', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
