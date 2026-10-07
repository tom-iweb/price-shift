import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const workspaceId = request.nextUrl.searchParams.get('workspaceId');
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!workspaceId || !token) throw new Error('Sign in and choose a workspace first.');
    const admin = createAdminClient(); const { data: auth } = await admin.auth.getUser(token);
    if (!auth.user) throw new Error('Your session is invalid.');
    const { data: member } = await admin.from('workspace_members').select('workspace_id').eq('workspace_id', workspaceId).eq('user_id', auth.user.id).maybeSingle();
    if (!member) throw new Error('You do not have permission to view these price changes.');
    const items: unknown[] = []; const pageSize = 500;
    for (let start = 0; ; start += pageSize) { const { data, error } = await admin.from('price_change_items').select('id,batch_id,old_price_pence,new_price_pence,old_option_values,new_option_values,status,error,price_change_batches!inner(uplift_pct,include_custom_options,created_at,workspace_id),products!inner(sku,name,category,brand,status)').eq('price_change_batches.workspace_id', workspaceId).order('created_at', { foreignTable: 'price_change_batches', ascending: false }).order('id').range(start, start + pageSize - 1); if (error) throw error; items.push(...(data ?? [])); if (!data || data.length < pageSize) break; }
    return NextResponse.json({ items });
  } catch (error) { const message = error instanceof Error ? error.message : 'Could not load price changes.'; return NextResponse.json({ error: message }, { status: 400 }); }
}
