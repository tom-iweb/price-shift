import { attribute, listMagentoOptions, listMagentoProductPage, MagentoProduct } from '@/lib/server/magento';
import { decryptSecret } from '@/lib/server/secrets';
import { createAdminClient } from '@/lib/supabase/admin';

const batchSize = 25;

async function importProduct(admin: ReturnType<typeof createAdminClient>, workspaceId: string, connection: Record<string, string>, remote: MagentoProduct) {
  const cost = Number(attribute(remote, 'cost') ?? 0);
  const supplier = attribute(remote, 'supplier') ?? null;
  const brand = attribute(remote, 'manufacturer') ?? attribute(remote, 'brand') ?? null;
  const category = remote.extension_attributes?.category_links?.[0]?.category_id ?? null;
  const { data: product, error: productError } = await admin.from('products').upsert({ workspace_id: workspaceId, sku: remote.sku, name: remote.name, category, brand, supplier, current_cost_pence: Math.round(cost * 100), new_cost_pence: Math.round(cost * 100), selling_price_pence: Math.round(Number(remote.price ?? 0) * 100), magento_product_id: remote.id, magento_product_type: remote.type_id ?? null, magento_payload: remote, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id,sku' }).select('id').single();
  if (productError || !product) throw productError ?? new Error(`Could not save ${remote.sku}.`);
  const accessToken = decryptSecret(connection.encrypted_access_token, connection.encryption_iv, connection.encryption_tag);
  const options = await listMagentoOptions(connection.base_url, connection.store_code, accessToken, remote.sku);
  if (!options.length) { const { error } = await admin.from('product_custom_options').delete().eq('product_id', product.id); if (error) throw error; return 0; }
  const rows = options.map((option) => ({ product_id: product.id, magento_option_id: option.option_id, title: option.title, input_type: option.type, is_required: option.is_require, sort_order: option.sort_order, option_values: option.values ?? [], updated_at: new Date().toISOString() }));
  const { error: optionsError } = await admin.from('product_custom_options').upsert(rows, { onConflict: 'product_id,magento_option_id' });
  if (optionsError) throw optionsError;
  const { error: staleOptionsError } = await admin.from('product_custom_options').delete().eq('product_id', product.id).not('magento_option_id', 'in', `(${rows.map((row) => row.magento_option_id).join(',')})`);
  if (staleOptionsError) throw staleOptionsError;
  return rows.length;
}

export async function processNextMagentoSyncJob() {
  const admin = createAdminClient();
  const { data: queued, error: queuedError } = await admin.from('magento_sync_jobs').select('*').eq('status', 'queued').order('created_at').limit(1).maybeSingle();
  if (queuedError) throw queuedError;
  const cutoff = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data: stale, error: staleError } = queued ? { data: null, error: null } : await admin.from('magento_sync_jobs').select('*').eq('status', 'running').lt('locked_at', cutoff).order('locked_at').limit(1).maybeSingle();
  if (staleError) throw staleError;
  const job = queued ?? stale;
  if (!job) return null;
  const now = new Date().toISOString();
  const { data: claimed, error: claimError } = await admin.from('magento_sync_jobs').update({ status: 'running', locked_at: now, started_at: job.started_at ?? now }).eq('id', job.id).eq('status', job.status).select('*').maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return null;
  try {
    const { data: connection, error: connectionError } = await admin.from('magento_connections').select('*').eq('workspace_id', claimed.workspace_id).single();
    if (connectionError || !connection) throw new Error('Magento connection settings are missing.');
    const accessToken = decryptSecret(connection.encrypted_access_token, connection.encryption_iv, connection.encryption_tag);
    const page = await listMagentoProductPage(connection.base_url, connection.store_code, accessToken, claimed.next_page, batchSize);
    let customOptions = 0;
    for (const remote of page.items) customOptions += await importProduct(admin, claimed.workspace_id, connection, remote);
    const processed = claimed.processed_products + page.items.length;
    const complete = page.items.length === 0 || processed >= page.total_count;
    const update = complete ? { status: 'completed', total_products: page.total_count, processed_products: processed, custom_options: claimed.custom_options + customOptions, locked_at: null, completed_at: new Date().toISOString(), error: null } : { status: 'queued', total_products: page.total_count, processed_products: processed, custom_options: claimed.custom_options + customOptions, next_page: claimed.next_page + 1, locked_at: null, error: null };
    const { error: updateError } = await admin.from('magento_sync_jobs').update(update).eq('id', claimed.id);
    if (updateError) throw updateError;
    if (complete) await admin.from('audit_log').insert({ workspace_id: claimed.workspace_id, action: 'magento_sync', subject_type: 'workspace', payload: { products: processed, customOptions: claimed.custom_options + customOptions }, created_by: claimed.created_by });
    return { id: claimed.id, status: complete ? 'completed' : 'queued', processed, total: page.total_count };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Magento sync failed.';
    await admin.from('magento_sync_jobs').update({ status: 'failed', error: message, locked_at: null }).eq('id', claimed.id);
    throw error;
  }
}
