import { query, get, run, getStore } from '../db.js';
import { getExchangeRates } from '../fxService.js';

/**
 * Offer Repository — manages supplier offers as first-class entities.
 */

export async function findByProduct(canonicalProductId) {
  const store = getStore();
  const offers = store.supplier_offers.filter(
    (o) => o.canonical_product_id === canonicalProductId
  );
  return offers.map((o) => {
    const supplier = store.suppliers.find((s) => s.id === o.supplier_id) || {};
    return { ...o, supplier };
  });
}

export async function findBySupplier(supplierId) {
  const store = getStore();
  return store.supplier_offers.filter((o) => o.supplier_id === supplierId);
}

export async function findAll() {
  const store = getStore();
  return store.supplier_offers.map((o) => {
    const supplier = store.suppliers.find((s) => s.id === o.supplier_id) || {};
    return { ...o, supplier };
  });
}

export async function upsert(offerData) {
  const store = getStore();

  // Check if an offer already exists for this supplier + canonical product
  const existing = store.supplier_offers.find(
    (o) => o.canonical_product_id === offerData.canonical_product_id &&
           o.supplier_id === offerData.supplier_id
  );

  if (existing) {
    // Update existing offer
    existing.cost = offerData.cost;
    existing.currency = offerData.currency;
    existing.cost_in_base_currency = offerData.cost_in_base_currency;
    existing.quantity_available = offerData.quantity_available || 0;
    existing.stock_status = offerData.stock_status || 'in_stock';
    existing.supplier_sku = offerData.supplier_sku || existing.supplier_sku;
    existing.supplier_name = offerData.supplier_name || existing.supplier_name;
    existing.warranty_terms = offerData.warranty_terms || existing.warranty_terms;
    existing.raw_listing_id = offerData.raw_listing_id || existing.raw_listing_id;
    existing.updated_at = new Date().toISOString();
    const { saveStore } = await import('../db.js');
    // Trigger save (getStore gives direct reference, but we need to persist)
    await run(`UPDATE supplier_offers SET cost = ?, cost_in_base_currency = ?, quantity_available = ? WHERE id = ?`,
      [existing.cost, existing.cost_in_base_currency, existing.quantity_available, existing.id]);
    return existing;
  }

  // Create new offer
  const id = offerData.id || `off_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await run(
    `INSERT INTO supplier_offers (id, canonical_product_id, supplier_id, raw_listing_id, supplier_sku, supplier_name, cost, currency, cost_in_base_currency, quantity_available, stock_status, warranty_terms, source_import_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      offerData.canonical_product_id,
      offerData.supplier_id,
      offerData.raw_listing_id || null,
      offerData.supplier_sku || '',
      offerData.supplier_name || '',
      offerData.cost,
      offerData.currency || 'USD',
      offerData.cost_in_base_currency,
      offerData.quantity_available || 0,
      offerData.stock_status || 'in_stock',
      offerData.warranty_terms || '',
      offerData.source_import_id || null
    ]
  );
  return { id, ...offerData };
}

export async function getCompetitiveOffers(canonicalProductId) {
  const offers = await findByProduct(canonicalProductId);
  return offers.sort((a, b) => a.cost_in_base_currency - b.cost_in_base_currency);
}

export async function parseStockQuantity(stockText) {
  if (!stockText) return 0;
  const text = String(stockText).toLowerCase().trim();
  const numMatch = text.match(/(\d+)/);
  if (numMatch) return parseInt(numMatch[1], 10);
  if (text.includes('in stock') || text.includes('available')) return 10; // default assumption
  if (text.includes('out of stock') || text.includes('sold out')) return 0;
  if (text.includes('backorder') || text.includes('pre-order')) return 0;
  return 0;
}
