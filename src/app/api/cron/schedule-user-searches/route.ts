import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This route is invoked by Vercel Cron. It schedules a pending search_run per user
// based on their most recent successful search parameters, overriding hours_old to 3.

export const dynamic = 'force-dynamic';

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
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

    const latestByUser = new Map<string, any>();
    for (const r of runs || []) {
      if (!r.user_id) continue;
      if (!latestByUser.has(r.user_id)) latestByUser.set(r.user_id, r);
    }

    if (latestByUser.size === 0) {
      return json(200, { success: true, inserted: 0, note: 'no_users_with_successful_runs' });
    }

  // 2) Build pending inserts overriding hours_old to 1 ("Within Past 1 hour")
    const nowIso = new Date().toISOString();
    const rows = Array.from(latestByUser.entries()).map(([userId, row]) => {
      const params = { ...(row.parameters || {}) } as Record<string, any>;
  params.hours_old = 1; // force to 1 hour window irrespective of previous search

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
    for (let i = 0; i < rows.length; i += batchSize) {
      const slice = rows.slice(i, i + batchSize);
      const { error: insertErr } = await admin.from('search_runs').insert(slice);
      if (insertErr) {
        return json(500, { error: 'insert_failed', details: insertErr.message, inserted });
      }
      inserted += slice.length;
    }

    return json(200, { success: true, inserted });
  } catch (e) {
    return json(500, { error: 'exception', details: e instanceof Error ? e.message : 'unknown' });
  }
}

// Optional: allow GET for quick manual trigger (still requires secret)
export async function GET(req: NextRequest) {
  return POST(req);
}
