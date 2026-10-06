import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptSecret } from '@/lib/server/secrets';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'Sign in before saving connection details.' }, { status: 401 });
    const { workspaceId, baseUrl, accessToken, storeCode } = await request.json();
    if (!workspaceId || !baseUrl || !accessToken) return NextResponse.json({ error: 'Workspace, Magento URL and token are required.' }, { status: 400 });
    const admin = createAdminClient();
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: 'Your session is invalid.' }, { status: 401 });
    const { data: membership } = await admin.from('workspace_members').select('role').eq('workspace_id', workspaceId).eq('user_id', auth.user.id).in('role', ['admin', 'editor']).maybeSingle();
    if (!membership) return NextResponse.json({ error: 'You do not have permission to update this workspace.' }, { status: 403 });
    const secret = encryptSecret(accessToken);
    const { error } = await admin.from('magento_connections').upsert({ workspace_id: workspaceId, base_url: baseUrl.replace(/\/$/, ''), store_code: storeCode || 'default', encrypted_access_token: secret.ciphertext, encryption_iv: secret.iv, encryption_tag: secret.tag, updated_by: auth.user.id, updated_at: new Date().toISOString() });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not save Magento settings.' }, { status: 500 }); }
}
