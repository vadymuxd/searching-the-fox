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
    // Best-effort, non-blocking trigger; do not await
    fetch(`${RENDER_API_URL}/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      // keepalive hints the runtime to try to complete the request even
      // if the function is about to finish
      keepalive: true,
    }).catch(() => {
      // Swallow errors - Render will update the run status
    });
  } catch {
    // Ignore - fire-and-forget
  }
}

/**
 * Warm up Render service to reduce cold-start impact
 * Await up to 5s for health response; ignore errors.
 */
async function warmRender() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    await fetch(`${RENDER_API_URL}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    }).catch(() => {});
    clearTimeout(timeoutId);
  } catch {
    // best-effort only
  }
}

/**
 * Ask the Render worker to poll the queue and start processing pending runs.
 * We await the initial request (up to 8s) to ensure delivery.
 */
async function triggerRenderPollQueue(batchSize = 10) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const url = `${RENDER_API_URL}/worker/poll-queue?batch_size=${encodeURIComponent(batchSize)}`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    }).catch(() => {});
    clearTimeout(timeoutId);
  } catch {
    // Ignore - best-effort delivery
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
    // Best-effort warm-up to improve first request delivery on cold starts
    await warmRender();
    
    // 1) Fetch ALL users with email_notifications_enabled=true
    const { data: subscribedUsers, error: usersErr } = await admin
      .from('users')
      .select('id, preferences')
      .eq('email_notifications_enabled', true);

    if (usersErr) {
      return json(500, { error: 'fetch_users_failed', details: usersErr.message });
    }

    if (!subscribedUsers || subscribedUsers.length === 0) {
      return json(200, { success: true, inserted: 0, note: 'no_subscribed_users' });
    }

    // 2) For each user, try to get their latest successful search parameters
    // If no successful search exists, use default parameters
    const { data: runs, error: fetchErr } = await admin
      .from('search_runs')
      .select('user_id, parameters, completed_at')
      .eq('status', 'success')
      .order('completed_at', { ascending: false })
      .limit(2000);

    if (fetchErr) {
      // Continue even if we can't fetch runs - will use defaults
      console.warn('Failed to fetch search_runs:', fetchErr.message);
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

    // 3) Build pending inserts for ALL subscribed users
    const nowIso = new Date().toISOString();
    const rows = subscribedUsers.map(user => {
      const userId = user.id;
      const userPrefs = (user.preferences as Record<string, unknown>) || {};
      const lastSearch = userPrefs.lastSearch as Record<string, unknown> | undefined;      // Use parameters from latest successful search, or lastSearch from preferences, or defaults
      let params: Record<string, unknown>;
      const latestRun = latestByUser.get(userId);
      
      if (latestRun?.parameters) {
        // Use last successful search parameters
        params = { ...latestRun.parameters };
      } else if (lastSearch) {
        // Fallback to user preferences
        params = {
          site: lastSearch.site || 'all',
          jobTitle: lastSearch.jobTitle || 'jobs',
          location: lastSearch.location || 'London',
          results_wanted: Number(lastSearch.resultsWanted) || 1000,
          country_indeed: String(lastSearch.country_indeed || 'UK'),
        };
      } else {
        // Ultimate fallback: generic search
        params = {
          site: 'all',
          jobTitle: 'jobs',
          location: 'London',
          results_wanted: 1000,
          country_indeed: 'UK',
        };
      }
      
      // Force to 24 hour window for CRON searches
      params.hours_old = 24;
      
      return {
        user_id: userId,
        source: 'cron',
        client_context: { triggered_by: 'vercel_cron', at: nowIso },
        parameters: params,
        status: 'pending',
      };
    });

    // 4) Insert in batches to be safe
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

    // 5) Reliability nudge: explicitly ask Render to poll the queue so that pending runs start
    // processing even if some per-run /scrape calls were not delivered due to serverless teardown.
    // Use a moderate batch size; the worker will loop internally.
    await triggerRenderPollQueue(15);

    return json(200, { success: true, inserted, triggered: insertedRunIds.length, queue_wakeup: true });
  } catch (e) {
    return json(500, { error: 'exception', details: e instanceof Error ? e.message : 'unknown' });
  }
}

// Optional: allow GET for quick manual trigger (still requires secret)
export async function GET(req: NextRequest) {
  return POST(req);
}
