import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

async function authorize(request: NextRequest, workspaceId: unknown) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token || typeof workspaceId !== 'string') throw new Error('Sign in and choose a workspace before starting a sync.');
  const admin = createAdminClient();
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) throw new Error('Your session is invalid.');
  const { data: membership } = await admin.from('workspace_members').select('role').eq('workspace_id', workspaceId).eq('user_id', auth.user.id).in('role', ['admin', 'editor']).maybeSingle();
  if (!membership) throw new Error('You do not have permission to sync this workspace.');
  return { admin, userId: auth.user.id, workspaceId };
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Magento sync failed.';
  const status = message.includes('permission') ? 403 : message.includes('session') || message.includes('Sign in') ? 401 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const { admin, workspaceId } = await authorize(request, request.nextUrl.searchParams.get('workspaceId'));
    const { data, error } = await admin.from('magento_sync_jobs').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ job: data });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json(); const { admin, userId, workspaceId } = await authorize(request, body.workspaceId);
    const { data: connection, error: connectionError } = await admin.from('magento_connections').select('workspace_id').eq('workspace_id', workspaceId).maybeSingle();
    if (connectionError || !connection) throw new Error('Save Magento 2 connection settings before syncing.');
    const { data: active, error: activeError } = await admin.from('magento_sync_jobs').select('*').eq('workspace_id', workspaceId).in('status', ['queued', 'running']).maybeSingle();
    if (activeError) throw activeError;
    if (active) return NextResponse.json({ job: active, alreadyQueued: true }, { status: 202 });
    const { data: failed, error: failedError } = await admin.from('magento_sync_jobs').select('*').eq('workspace_id', workspaceId).eq('status', 'failed').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (failedError) throw failedError;
    const update = { status: 'queued', error: null, locked_at: null, started_at: null, completed_at: null };
    const { data: job, error } = failed ? await admin.from('magento_sync_jobs').update(update).eq('id', failed.id).select('*').single() : await admin.from('magento_sync_jobs').insert({ workspace_id: workspaceId, created_by: userId }).select('*').single();
    if (error || !job) throw error ?? new Error('Could not queue Magento sync.');
    return NextResponse.json({ job }, { status: 202 });
  } catch (error) { return errorResponse(error); }
}
