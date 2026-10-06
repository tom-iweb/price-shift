export type MagentoProduct = { id: number; sku: string; name: string; price?: number; type_id?: string; custom_attributes?: Array<{ attribute_code: string; value: string }>; extension_attributes?: { category_links?: Array<{ category_id: string }> } };
export type MagentoOption = { option_id: number; title: string; type: string; is_require: boolean; sort_order: number; values?: Array<{ option_type_id: number; title: string; price: number; price_type: string; sku?: string; sort_order: number }> };

function endpoint(baseUrl: string, storeCode: string, path: string) {
  const root = baseUrl.replace(/\/$/, '');
  return `${root}/rest/${encodeURIComponent(storeCode || 'default')}/V1${path}`;
}

async function magentoFetch<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) throw new Error(`Magento responded with ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

export async function listMagentoProducts(baseUrl: string, storeCode: string, token: string) {
  const all: MagentoProduct[] = [];
  let page = 1;
  while (true) {
    const query = new URLSearchParams({ 'searchCriteria[currentPage]': String(page), 'searchCriteria[pageSize]': '100' });
    const result = await magentoFetch<{ items: MagentoProduct[]; total_count: number }>(endpoint(baseUrl, storeCode, `/products?${query}`), token);
    all.push(...result.items);
    if (all.length >= result.total_count || result.items.length === 0) return all;
    page += 1;
  }
}

export async function listMagentoOptions(baseUrl: string, storeCode: string, token: string, sku: string) {
  return magentoFetch<MagentoOption[]>(endpoint(baseUrl, storeCode, `/products/${encodeURIComponent(sku)}/options`), token);
}

export function attribute(product: MagentoProduct, name: string) {
  return product.custom_attributes?.find((item) => item.attribute_code === name)?.value ?? null;
}
