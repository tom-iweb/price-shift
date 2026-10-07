export type MagentoProduct = { id: number; sku: string; name: string; price?: number; type_id?: string; custom_attributes?: Array<{ attribute_code: string; value: string }>; extension_attributes?: { category_links?: Array<{ category_id: string }> } };
export type MagentoOption = { option_id: number; title: string; type: string; is_require: boolean; sort_order: number; values?: Array<{ option_type_id: number; title: string; price: number; price_type: string; sku?: string; sort_order: number }> };

function endpoint(baseUrl: string, storeCode: string, path: string) {
  const root = baseUrl.replace(/\/$/, '');
  return `${root}/rest/${encodeURIComponent(storeCode || 'default')}/V1${path}`;
}

async function magentoFetch<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'User-Agent': process.env.MAGENTO_SYNC_USER_AGENT || 'PriceShift-Magento-Sync/1.0' }, cache: 'no-store' });
  if (!response.ok) throw new Error(`Magento responded with ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

export async function listMagentoProductPage(baseUrl: string, storeCode: string, token: string, page: number, pageSize = 25) {
  const query = new URLSearchParams({ 'searchCriteria[currentPage]': String(page), 'searchCriteria[pageSize]': String(pageSize) });
  return magentoFetch<{ items: MagentoProduct[]; total_count: number }>(endpoint(baseUrl, storeCode, `/products?${query}`), token);
}

export async function listMagentoOptions(baseUrl: string, storeCode: string, token: string, sku: string) {
  return magentoFetch<MagentoOption[]>(endpoint(baseUrl, storeCode, `/products/${encodeURIComponent(sku)}/options`), token);
}

export function attribute(product: MagentoProduct, name: string) {
  return product.custom_attributes?.find((item) => item.attribute_code === name)?.value ?? null;
}
