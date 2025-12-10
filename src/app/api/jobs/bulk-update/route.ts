import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Bulk update job statuses server-side
 * This endpoint handles large batch updates without client involvement
 * POST /api/jobs/bulk-update
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userJobIds, targetStatus, operationType, userId } = body;

    // Validate input
    if (!Array.isArray(userJobIds) || userJobIds.length === 0) {
      return NextResponse.json(
        { error: 'userJobIds must be a non-empty array' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    if (operationType !== 'status-change' && operationType !== 'remove') {
      return NextResponse.json(
        { error: 'operationType must be "status-change" or "remove"' },
        { status: 400 }
      );
    }

    if (operationType === 'status-change' && !targetStatus) {
      return NextResponse.json(
        { error: 'targetStatus is required for status-change operation' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log(`[bulk-update] Starting ${operationType} for ${userJobIds.length} jobs`);

    let successCount = 0;
    let failedCount = 0;
    const errors: Array<{ userJobId: string; error: string }> = [];

    // Choose implementation based on preference
    // Method 1: Database function (fastest, requires SQL function to be created)
    // Method 2: Direct Supabase query (works out of the box)
    const USE_DB_FUNCTION = true; // Using database functions for maximum performance

    if (USE_DB_FUNCTION) {
      // ===== METHOD 1: Database Function (Recommended) =====
      if (operationType === 'remove') {
        const { data, error: rpcError } = await supabase.rpc('bulk_delete_user_jobs', {
          p_user_id: userId,
          p_user_job_ids: userJobIds,
        });

        if (rpcError) {
          console.error('[bulk-update] RPC delete error:', rpcError);
          return NextResponse.json(
            {
              success: false,
              error: rpcError.message,
              successCount: 0,
              failedCount: userJobIds.length,
            },
            { status: 500 }
          );
        }

        successCount = data?.[0]?.success_count || 0;
        failedCount = data?.[0]?.failed_count || 0;

      } else if (operationType === 'status-change') {
        const { data, error: rpcError } = await supabase.rpc('bulk_update_user_job_status', {
          p_user_id: userId,
          p_user_job_ids: userJobIds,
          p_new_status: targetStatus,
        });

        if (rpcError) {
          console.error('[bulk-update] RPC update error:', rpcError);
          return NextResponse.json(
            {
              success: false,
              error: rpcError.message,
              successCount: 0,
              failedCount: userJobIds.length,
            },
            { status: 500 }
          );
        }

        successCount = data?.[0]?.success_count || 0;
        failedCount = data?.[0]?.failed_count || 0;
      }
    } else {
      // ===== METHOD 2: Direct Query (Default) =====
      if (operationType === 'remove') {
        // Bulk delete - much faster using a single query
        const { error: deleteError, count } = await supabase
          .from('user_jobs')
          .delete({ count: 'exact' })
          .in('id', userJobIds)
          .eq('user_id', userId); // Security: ensure user owns these jobs

        if (deleteError) {
          console.error('[bulk-update] Bulk delete error:', deleteError);
          return NextResponse.json(
            {
              success: false,
              error: deleteError.message,
              successCount: 0,
              failedCount: userJobIds.length,
            },
            { status: 500 }
          );
        }

        successCount = count || 0;
        failedCount = userJobIds.length - successCount;

      } else if (operationType === 'status-change') {
        // Bulk status update - single query
        const { error: updateError, count } = await supabase
          .from('user_jobs')
          .update({
            status: targetStatus,
            updated_at: new Date().toISOString(),
          }, { count: 'exact' })
          .in('id', userJobIds)
          .eq('user_id', userId); // Security: ensure user owns these jobs

        if (updateError) {
          console.error('[bulk-update] Bulk update error:', updateError);
          return NextResponse.json(
            {
              success: false,
              error: updateError.message,
              successCount: 0,
              failedCount: userJobIds.length,
            },
            { status: 500 }
          );
        }

        successCount = count || 0;
        failedCount = userJobIds.length - successCount;
      }
    }

    console.log(`[bulk-update] Completed: ${successCount} successful, ${failedCount} failed`);

    return NextResponse.json({
      success: true,
      successCount,
      failedCount,
      errors,
      message: failedCount === 0 
        ? `All ${successCount} jobs processed successfully`
        : `${successCount} jobs processed successfully, ${failedCount} failed`,
    });

  } catch (error) {
    console.error('[bulk-update] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        successCount: 0,
        failedCount: 0,
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
