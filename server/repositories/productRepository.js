import { query, get, run, getStore } from '../db.js';

/**
 * Product Repository — abstracts canonical product storage.
 * Business logic never touches db.js directly for product operations.
 */

export async function findById(id) {
  return get(`SELECT * FROM canonical_products WHERE id = ?`, [id]);
}

export async function findAll({ excludeMerged = true } = {}) {
  if (excludeMerged) {
    return query(`SELECT * FROM canonical_products WHERE merged_into_id IS NULL`);
  }
  return query(`SELECT * FROM canonical_products`);
}

export async function findByNormalizedName(normalizedName) {
  const store = getStore();
  return store.canonical_products.find(
    (p) => !p.merged_into_id && p.normalized_name === normalizedName
  ) || null;
}

export async function findCandidates(normalizedAttrs) {
  const store = getStore();
  return store.canonical_products.filter((p) => {
    if (p.merged_into_id) return false;

    // Match by brand + model if both exist
    if (normalizedAttrs.brand && normalizedAttrs.model_series) {
      const specs = typeof p.specifications === 'string'
        ? JSON.parse(p.specifications || '{}')
        : (p.specifications || {});
      const attrs = typeof p.attributes === 'string'
        ? JSON.parse(p.attributes || '{}')
        : (p.attributes || {});

      const pBrand = (p.brand || attrs.brand || '').toUpperCase();
      const pModel = (p.model_number || attrs.model_series || '').toUpperCase();

      if (pBrand === normalizedAttrs.brand.toUpperCase() &&
          pModel.includes(normalizedAttrs.model_series.toUpperCase())) {
        return true;
      }
    }
    return false;
  });
}

export async function create(productData) {
  const id = productData.id || `cp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await run(
    `INSERT INTO canonical_products (id, canonical_name, brand, category, model_number, normalized_name, specifications, identifiers, attributes, match_confidence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      productData.canonical_name,
      productData.brand || 'Generic',
      productData.category || 'Electronics',
      productData.model_number || '',
      productData.normalized_name || '',
      productData.specifications || {},
      productData.identifiers || {},
      productData.attributes || {},
      productData.match_confidence || 1.0
    ]
  );
  return findById(id);
}

export async function merge(targetId, sourceId) {
  await run(`UPDATE raw_listings SET canonical_product_id = ? WHERE canonical_product_id = ?`, [targetId, sourceId]);

  // Move supplier offers from source to target
  const store = getStore();
  store.supplier_offers.forEach((o) => {
    if (o.canonical_product_id === sourceId) {
      o.canonical_product_id = targetId;
    }
  });

  await run(`UPDATE canonical_products SET merged_into_id = ? WHERE id = ?`, [targetId, sourceId]);

  await run(
    `INSERT INTO audit_logs (id, action, entity_type, entity_id, before, after) VALUES (?, 'MERGE_PRODUCTS', 'canonical_product', ?, ?, ?)`,
    [`aud_${Date.now()}`, targetId, JSON.stringify({ sourceId }), JSON.stringify({ targetId })]
  );
}

export async function split(rawListingId, userId = 'sys') {
  const listing = await get(`SELECT * FROM raw_listings WHERE id = ?`, [rawListingId]);
  if (!listing) throw new Error('Listing not found');

  const oldCanonicalId = listing.canonical_product_id;

  const newProduct = await create({
    canonical_name: listing.raw_name,
    brand: listing.brand || 'Generic',
    category: listing.category || 'Electronics',
    model_number: listing.raw_sku || ''
  });

  await run(`UPDATE raw_listings SET canonical_product_id = ?, match_status = 'confirmed' WHERE id = ?`, [newProduct.id, rawListingId]);

  // Migrate supplier offers and price observations belonging to this raw listing
  const store = getStore();
  store.supplier_offers.forEach((o) => {
    if (o.raw_listing_id === rawListingId) {
      o.canonical_product_id = newProduct.id;
    }
  });

  store.price_observations.forEach((p) => {
    if (p.source_import_id === listing.supplier_import_id && p.supplier_id === listing.supplier_id && p.canonical_product_id === oldCanonicalId) {
      p.canonical_product_id = newProduct.id;
    }
  });

  await run(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, before, after) VALUES (?, ?, 'SPLIT_PRODUCT', 'canonical_product', ?, ?, ?)`,
    [
      `aud_${Date.now()}`,
      userId,
      newProduct.id,
      JSON.stringify({ rawListingId, oldCanonicalId }),
      JSON.stringify({ newCanonicalId: newProduct.id })
    ]
  );

  return newProduct;
}
