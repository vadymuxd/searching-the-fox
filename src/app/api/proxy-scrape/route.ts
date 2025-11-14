import { NextRequest, NextResponse } from 'next/server';

// Direct Render API base
const RENDER_API_URL = 'https://truelist-jobspy-api.onrender.com';

// Small helper for structured logging
function log(meta: Record<string, unknown>) {
  try {
    console.log('[Proxy]', JSON.stringify(meta));
  } catch {
    console.log('[Proxy]', meta);
  }
}

export async function POST(request: NextRequest) {
  let body: {
    search_term?: string;
    location?: string;
    site_name?: string[];
    results_wanted?: number;
    hours_old?: number;
    country_indeed?: string;
    run_id?: string;
    user_id?: string;
  } = {};

  const startOverall = Date.now();

  try {
    log({ event: 'received_request' });
    body = await request.json();
    log({ event: 'parsed_body', search_term: body.search_term, location: body.location, site_count: body.site_name?.length, run_id: body.run_id, masked_user_id: body.user_id ? '***' : null });

    // 1. Attempt to warm the Render service with a lightweight health ping.
    //    We await this so that the TCP handshake completes before we send the heavy scrape.
    //    If it fails we still proceed to send the scrape request.
    let healthStatus: number | null = null;
    try {
      const healthStart = Date.now();
      const healthResp = await fetch(`${RENDER_API_URL}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store',
      });
      healthStatus = healthResp.status;
      log({ event: 'health_ping', status: healthStatus, elapsed_ms: Date.now() - healthStart });
    } catch (e) {
      log({ event: 'health_ping_failed', error: e instanceof Error ? e.message : 'unknown_error' });
    }

    // 2. Send the scrape request. We AWAIT the initial response to be certain the request left Vercel
    //    (fire-and-forget inside a serverless context can be dropped when the function exits).
    //    Render may still be cold; if it times out Vercel will terminate, but the request should have reached Render.
    const scrapeStart = Date.now();
    let delivered = false;
    let status: number | null = null;
    let scrapeError: string | null = null;

    try {
      const scrapeResp = await fetch(`${RENDER_API_URL}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      status = scrapeResp.status;
      delivered = true; // Reaching any HTTP status means Render received the request
      // We DO NOT parse the body fully to minimize time spent in this function.
      log({ event: 'scrape_response', status, elapsed_ms: Date.now() - scrapeStart });
    } catch (e) {
      scrapeError = e instanceof Error ? e.message : 'unknown_error';
      log({ event: 'scrape_fetch_failed', error: scrapeError, elapsed_ms: Date.now() - scrapeStart });
    }

    // 3. Respond back to client quickly with delivery info. The client/browser will subscribe to DB changes.
    const totalElapsed = Date.now() - startOverall;
    log({ event: 'completed_proxy', delivered, total_elapsed_ms: totalElapsed });

    if (!delivered) {
      return NextResponse.json({
        success: false,
        delivered: false,
        message: 'Failed to deliver scrape request to Render',
        error: scrapeError,
        health_status: healthStatus,
      }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      delivered: true,
      render_status: status,
      health_status: healthStatus,
      message: 'Scrape request delivered to Render. Status updates will propagate via search_runs.',
    });
  } catch (error) {
    log({ event: 'proxy_exception', error: error instanceof Error ? error.message : 'unknown_error' });
    return NextResponse.json({
      success: false,
      error: 'proxy_failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
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
