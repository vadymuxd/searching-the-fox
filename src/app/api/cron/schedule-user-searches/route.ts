import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This route is invoked by Vercel Cron. It schedules a pending search_run per user
// based on their most recent successful search parameters, overriding hours_old to 3.

export const dynamic = 'force-dynamic';

const RENDER_API_URL = 'https://truelist-jobspy-api.onrender.com';

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

/**
 * Trigger Render to scrape jobs for a given search run
 * Fire-and-forget - don't wait for response
 */
async function triggerRenderScrape(runId: string, userId: string, parameters: Record<string, unknown>) {
  const requestBody = {
    search_term: parameters.jobTitle || '',
    location: parameters.location || '',
    site_name: parameters.site === 'all' 
      ? ['linkedin', 'indeed'] 
      : [parameters.site || 'indeed'],
    results_wanted: Number(parameters.results_wanted) || 1000,
    hours_old: Number(parameters.hours_old) || 24,
    country_indeed: String(parameters.country_indeed || 'UK'),
    run_id: runId,
    user_id: userId,
  };

  try {
    // Fire-and-forget: send request but don't wait for full response
    fetch(`${RENDER_API_URL}/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      // keepalive ensures request is sent even if function completes
      signal: AbortSignal.timeout(8000), // Abort after 8s to avoid Vercel timeout
    }).catch(() => {
      // Swallow errors - Render will update the run status
    });
  } catch {
    // Ignore - fire-and-forget
  }
}

export async function POST(req: NextRequest) {
  // AuthN options:
  // - Vercel Cron adds `x-vercel-cron` header to scheduled invocations
  // - For manual triggers: allow header x-cron-secret / Authorization: Bearer / ?secret= query param
  const isVercelCron = !!req.headers.get('x-vercel-cron');
  const headerSecret = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace('Bearer ', '');
  const urlSecret = new URL(req.url).searchParams.get('secret') || undefined;
  const provided = headerSecret || urlSecret;
  const expected = process.env.CRON_SECRET;
  if (!isVercelCron && (!provided || provided !== expected)) {
    return json(401, { error: 'unauthorized' });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return json(500, { error: 'supabase_not_configured' });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  try {
    // 1) Fetch recent successful runs ordered by completion time (server-side)
    // We’ll dedupe in memory to get the latest per user
    const { data: runs, error: fetchErr } = await admin
      .from('search_runs')
      .select('user_id, parameters, completed_at')
      .eq('status', 'success')
      .order('completed_at', { ascending: false })
      .limit(2000); // safety cap

    if (fetchErr) {
      return json(500, { error: 'fetch_failed', details: fetchErr.message });
    }

    interface RawSearchRunRow {
      user_id: string;
      parameters?: Record<string, unknown> | null;
      completed_at?: string | null;
    }
    const castRuns: RawSearchRunRow[] = (runs as RawSearchRunRow[] | null) || [];
    const latestByUser = new Map<string, RawSearchRunRow>();
    for (const r of castRuns) {
      if (!r.user_id) continue;
      if (!latestByUser.has(r.user_id)) latestByUser.set(r.user_id, r);
    }

    if (latestByUser.size === 0) {
      return json(200, { success: true, inserted: 0, note: 'no_users_with_successful_runs' });
    }

  // 2) Build pending inserts overriding hours_old to 24 ("Within Past 24 hours")
    const nowIso = new Date().toISOString();
    const rows = Array.from(latestByUser.entries()).map(([userId, row]) => {
      const params: Record<string, unknown> = { ...(row.parameters || {}) };
      // Force to 24 hour window irrespective of previous search
      params.hours_old = 24;
      return {
        user_id: userId,
        source: 'cron',
        client_context: { triggered_by: 'vercel_cron', at: nowIso },
        parameters: params,
        status: 'pending',
      };
    });

    // 3) Insert in batches to be safe
    const batchSize = 500;
    let inserted = 0;
    const insertedRunIds: string[] = [];
    
    for (let i = 0; i < rows.length; i += batchSize) {
      const slice = rows.slice(i, i + batchSize);
      const { data: insertedRuns, error: insertErr } = await admin.from('search_runs').insert(slice).select('id, user_id, parameters');
      if (insertErr) {
        return json(500, { error: 'insert_failed', details: insertErr.message, inserted });
      }
      if (insertedRuns) {
        inserted += insertedRuns.length;
        // Collect run IDs and trigger Render scrape for each
        for (const run of insertedRuns) {
          insertedRunIds.push(run.id);
          // Fire-and-forget call to Render (don't await)
          triggerRenderScrape(run.id, run.user_id, run.parameters as Record<string, unknown>).catch((err: Error) => {
            console.error(`Failed to trigger Render for run ${run.id}:`, err.message);
          });
        }
      }
    }

    return json(200, { success: true, inserted, triggered: insertedRunIds.length });
  } catch (e) {
    return json(500, { error: 'exception', details: e instanceof Error ? e.message : 'unknown' });
  }
}

// Optional: allow GET for quick manual trigger (still requires secret)
export async function GET(req: NextRequest) {
  return POST(req);
}
