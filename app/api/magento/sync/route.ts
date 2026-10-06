import { NextRequest, NextResponse } from 'next/server';
import { attribute, listMagentoOptions, listMagentoProducts } from '@/lib/server/magento';
import { decryptSecret } from '@/lib/server/secrets';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'Sign in before starting a sync.' }, { status: 401 });
    const { workspaceId } = await request.json();
    if (!workspaceId) return NextResponse.json({ error: 'Workspace is required.' }, { status: 400 });
    const admin = createAdminClient();
    const { data: auth } = await admin.auth.getUser(token);
    if (!auth.user) return NextResponse.json({ error: 'Your session is invalid.' }, { status: 401 });
    const { data: membership } = await admin.from('workspace_members').select('role').eq('workspace_id', workspaceId).eq('user_id', auth.user.id).in('role', ['admin', 'editor']).maybeSingle();
    if (!membership) return NextResponse.json({ error: 'You do not have permission to sync this workspace.' }, { status: 403 });
    const { data: connection, error: connectionError } = await admin.from('magento_connections').select('*').eq('workspace_id', workspaceId).single();
    if (connectionError || !connection) return NextResponse.json({ error: 'Save Magento 2 connection settings before syncing.' }, { status: 400 });
    const accessToken = decryptSecret(connection.encrypted_access_token, connection.encryption_iv, connection.encryption_tag);
    const remoteProducts = await listMagentoProducts(connection.base_url, connection.store_code, accessToken);
    let optionCount = 0;
    for (const remote of remoteProducts) {
      const cost = Number(attribute(remote, 'cost') ?? 0);
      const supplier = attribute(remote, 'supplier') ?? null;
      const brand = attribute(remote, 'manufacturer') ?? attribute(remote, 'brand') ?? null;
      const category = remote.extension_attributes?.category_links?.[0]?.category_id ?? null;
      const { data: product, error: productError } = await admin.from('products').upsert({ workspace_id: workspaceId, sku: remote.sku, name: remote.name, category, brand, supplier, current_cost_pence: Math.round(cost * 100), new_cost_pence: Math.round(cost * 100), selling_price_pence: Math.round(Number(remote.price ?? 0) * 100), magento_product_id: remote.id, magento_product_type: remote.type_id ?? null, magento_payload: remote, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id,sku' }).select('id').single();
      if (productError) throw productError;
      const options = await listMagentoOptions(connection.base_url, connection.store_code, accessToken, remote.sku);
      if (options.length) {
        const rows = options.map((option) => ({ product_id: product.id, magento_option_id: option.option_id, title: option.title, input_type: option.type, is_required: option.is_require, sort_order: option.sort_order, option_values: option.values ?? [] }));
        const { error: optionsError } = await admin.from('product_custom_options').upsert(rows, { onConflict: 'product_id,magento_option_id' });
        if (optionsError) throw optionsError;
        optionCount += rows.length;
      }
    }
    await admin.from('audit_log').insert({ workspace_id: workspaceId, action: 'magento_sync', subject_type: 'workspace', payload: { products: remoteProducts.length, customOptions: optionCount }, created_by: auth.user.id });
    return NextResponse.json({ ok: true, products: remoteProducts.length, customOptions: optionCount });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Magento sync failed.' }, { status: 500 }); }
}
