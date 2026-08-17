import { run, getStore } from '../db.js';

/**
 * Price Observation Repository — append-only immutable price snapshots.
 * Every import creates historical observations that are never updated.
 */

export async function record(observation) {
  const id = observation.id || `pobs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await run(
    `INSERT INTO price_observations (id, supplier_id, canonical_product_id, price, currency, price_in_base_currency, stock_quantity, stock_status, captured_at, source_import_id, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      observation.supplier_id,
      observation.canonical_product_id,
      observation.price,
      observation.currency,
      observation.price_in_base_currency,
      observation.stock_quantity || 0,
      observation.stock_status || 'in_stock',
      observation.captured_at || new Date().toISOString(),
      observation.source_import_id || null,
      observation.source || 'excel_import'
    ]
  );
  return { id, ...observation };
}

export async function getHistory(productId, supplierId, { days = 30 } = {}) {
  const store = getStore();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return store.price_observations
    .filter((o) => {
      if (o.canonical_product_id !== productId) return false;
      if (supplierId && o.supplier_id !== supplierId) return false;
      return new Date(o.captured_at) >= cutoff;
    })
    .sort((a, b) => new Date(a.captured_at) - new Date(b.captured_at));
}

export async function getLatest(productId, supplierId) {
  const store = getStore();
  const observations = store.price_observations
    .filter((o) => o.canonical_product_id === productId && o.supplier_id === supplierId)
    .sort((a, b) => new Date(b.captured_at) - new Date(a.captured_at));
  return observations.length > 0 ? observations[0] : null;
}

export async function getAllForProduct(productId) {
  const store = getStore();
  return store.price_observations
    .filter((o) => o.canonical_product_id === productId)
    .sort((a, b) => new Date(a.captured_at) - new Date(b.captured_at));
}

export async function getObservationCount(productId, supplierId, { days = 30 } = {}) {
  const history = await getHistory(productId, supplierId, { days });
  return history.length;
}
