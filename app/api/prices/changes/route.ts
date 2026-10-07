import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

async function authorize(request: NextRequest, workspaceId: unknown) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token || typeof workspaceId !== 'string') throw new Error('Sign in and choose a workspace first.');
  const admin = createAdminClient();
  const { data: auth, error } = await admin.auth.getUser(token);
  if (error || !auth.user) throw new Error('Your session is invalid.');
  const { data: membership } = await admin.from('workspace_members').select('role').eq('workspace_id', workspaceId).eq('user_id', auth.user.id).in('role', ['admin', 'editor']).maybeSingle();
  if (!membership) throw new Error('You do not have permission to modify prices in this workspace.');
  return { admin, userId: auth.user.id, workspaceId };
}

function responseError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Could not create price changes.';
  return NextResponse.json({ error: message }, { status: message.includes('session') || message.includes('Sign in') ? 401 : message.includes('permission') ? 403 : 400 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { admin, userId, workspaceId } = await authorize(request, body.workspaceId);
    const uplift = Number(body.upliftPct);
    if (!Number.isFinite(uplift) || uplift === 0 || uplift < -99 || uplift > 1000) throw new Error('Enter an uplift between -99% and 1000%, excluding 0%.');
    const filters = body.filters ?? {};
    let query = admin.from('products').select('id,sku,selling_price_pence,product_custom_options(id,magento_option_id,title,input_type,is_required,sort_order,option_values)').eq('workspace_id', workspaceId).neq('status', 'price_pending');
    if (filters.sku?.trim()) query = query.ilike('sku', `%${filters.sku.trim()}%`);
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.brand) query = query.eq('brand', filters.brand);
    const { data: products, error } = await query;
    if (error) throw error;
    if (!products?.length) throw new Error('No products match these filters.');
    const multiplier = 1 + uplift / 100;
    const { data: batch, error: batchError } = await admin.from('price_change_batches').insert({ workspace_id: workspaceId, uplift_pct: uplift, include_custom_options: Boolean(body.includeCustomOptions), filters, created_by: userId }).select('id').single();
    if (batchError || !batch) throw batchError ?? new Error('Could not create price change batch.');
    const items = products.map((product: any) => {
      const options = product.product_custom_options ?? [];
      const optionChanges = Boolean(body.includeCustomOptions) ? options.map((option: any) => ({ ...option, option_values: (option.option_values ?? []).map((value: any) => value.price_type === 'fixed' ? { ...value, price: Math.round(Number(value.price || 0) * multiplier * 100) / 100 } : value) })) : null;
      return { batch_id: batch.id, product_id: product.id, old_price_pence: product.selling_price_pence, new_price_pence: Math.round(product.selling_price_pence * multiplier), old_option_values: body.includeCustomOptions ? options : null, new_option_values: optionChanges };
    });
    const { error: itemsError } = await admin.from('price_change_items').insert(items);
    if (itemsError) throw itemsError;
    const { error: productsError } = await admin.from('products').update({ status: 'price_pending', updated_at: new Date().toISOString() }).in('id', products.map((product: any) => product.id));
    if (productsError) throw productsError;
    await admin.from('audit_log').insert({ workspace_id: workspaceId, action: 'price_uplift_staged', subject_type: 'price_change_batch', subject_id: batch.id, payload: { upliftPct: uplift, products: products.length, includeCustomOptions: Boolean(body.includeCustomOptions), filters }, created_by: userId });
    return NextResponse.json({ batchId: batch.id, count: products.length });
  } catch (error) { return responseError(error); }
}
