import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptSecret } from '@/lib/server/secrets';
import { updateMagentoOption, updateMagentoPrice } from '@/lib/server/magento';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, itemIds } = await request.json();
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token || !workspaceId || !Array.isArray(itemIds) || !itemIds.length) throw new Error('Select at least one pending price change.');
    const admin = createAdminClient(); const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) throw new Error('Your session is invalid.');
    const { data: member } = await admin.from('workspace_members').select('role').eq('workspace_id', workspaceId).eq('user_id', auth.user.id).in('role', ['admin', 'editor']).maybeSingle();
    if (!member) throw new Error('You do not have permission to publish prices in this workspace.');
    const { data: connection, error: connectionError } = await admin.from('magento_connections').select('*').eq('workspace_id', workspaceId).maybeSingle();
    if (connectionError || !connection) throw new Error('Save Magento 2 connection settings before publishing prices.');
    const items: any[] = []; const pageSize = 500;
    for (let start = 0; start < itemIds.length; start += pageSize) { const { data, error } = await admin.from('price_change_items').select('id,batch_id,product_id,new_price_pence,new_option_values,products!inner(sku),price_change_batches!inner(workspace_id)').in('id', itemIds.slice(start, start + pageSize)).eq('status', 'pending').eq('price_change_batches.workspace_id', workspaceId); if (error) throw error; items.push(...(data ?? [])); }
    if (!items.length) throw new Error('The selected changes are no longer pending.');
    const accessToken = decryptSecret(connection.encrypted_access_token, connection.encryption_iv, connection.encryption_tag);
    const results: Array<{ id: string; ok: boolean; error?: string }> = [];
    for (const item of items) {
      try {
        await updateMagentoPrice(connection.base_url, connection.store_code, accessToken, item.products.sku, item.new_price_pence);
        for (const option of item.new_option_values ?? []) await updateMagentoOption(connection.base_url, connection.store_code, accessToken, item.products.sku, option);
        await admin.from('price_change_items').update({ status: 'published', published_at: new Date().toISOString(), error: null }).eq('id', item.id);
        await admin.from('products').update({ selling_price_pence: item.new_price_pence, status: 'applied', updated_at: new Date().toISOString() }).eq('id', item.product_id);
        for (const option of item.new_option_values ?? []) await admin.from('product_custom_options').update({ option_values: option.option_values, updated_at: new Date().toISOString() }).eq('id', option.id);
        results.push({ id: item.id, ok: true });
      } catch (publishError) {
        const message = publishError instanceof Error ? publishError.message : 'Magento update failed.';
        await admin.from('price_change_items').update({ status: 'failed', error: message }).eq('id', item.id);
        results.push({ id: item.id, ok: false, error: message });
      }
    }
    await admin.from('audit_log').insert({ workspace_id: workspaceId, action: 'price_changes_published', subject_type: 'workspace', payload: { published: results.filter(result => result.ok).length, failed: results.filter(result => !result.ok).length, itemIds }, created_by: auth.user.id });
    return NextResponse.json({ results });
  } catch (error) { const message = error instanceof Error ? error.message : 'Could not publish prices.'; return NextResponse.json({ error: message }, { status: message.includes('session') ? 401 : message.includes('permission') ? 403 : 400 }); }
}
