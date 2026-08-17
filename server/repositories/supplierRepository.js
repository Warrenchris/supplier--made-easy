import { query, get, run, getStore } from '../db.js';

/**
 * Supplier Repository — abstracts supplier storage.
 */

export async function findById(id) {
  return get(`SELECT * FROM suppliers WHERE id = ?`, [id]);
}

export async function findByName(name) {
  return get(`SELECT * FROM suppliers WHERE LOWER(name) = LOWER(?)`, [name]);
}

export async function findAll() {
  return query(`SELECT * FROM suppliers ORDER BY name ASC`);
}

export async function create(supplierData) {
  const id = supplierData.id || `sup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await run(
    `INSERT INTO suppliers (id, name, contact_info, currency_default, reliability_score, avg_delivery_days, warranty_terms_default)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      supplierData.name,
      supplierData.contact_info || '',
      supplierData.currency_default || 'USD',
      supplierData.reliability_score !== undefined ? supplierData.reliability_score : 8.0,
      supplierData.avg_delivery_days !== undefined ? supplierData.avg_delivery_days : 3,
      supplierData.warranty_terms_default || '1 Year Warranty'
    ]
  );
  return findById(id);
}

export async function updateReliability(id, score) {
  const store = getStore();
  const supplier = store.suppliers.find((s) => s.id === id);
  if (supplier) {
    supplier.reliability_score = score;
    await run(`INSERT INTO audit_logs (id, action, entity_type, entity_id, before, after) VALUES (?, 'UPDATE_RELIABILITY', 'supplier', ?, ?, ?)`,
      [`aud_${Date.now()}`, id, JSON.stringify({ old: supplier.reliability_score }), JSON.stringify({ new: score })]);
  }
  return supplier;
}

export async function getLastImportDate(supplierId) {
  const store = getStore();
  const imports = store.supplier_imports
    .filter((i) => i.supplier_id === supplierId)
    .sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
  return imports.length > 0 ? imports[0].uploaded_at : null;
}
