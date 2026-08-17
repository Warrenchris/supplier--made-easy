import express from 'express';
import { query, run, get } from './db.js';
import { processListingMatching } from './matchingEngine.js';
import { convertToBaseCurrency, getExchangeRates, setExchangeRate } from './fxService.js';
import { getScoringWeights, updateScoringWeights, calculateSupplierScore } from './scoringEngine.js';

const router = express.Router();

// 1. GET Canonical Products with Supplier Offers, Recommended Supplier, and Price History
router.get('/canonical-products', async (req, res) => {
  try {
    const products = await query(`SELECT * FROM canonical_products WHERE merged_into_id IS NULL ORDER BY updated_at DESC`);
    const suppliers = await query(`SELECT * FROM suppliers`);
    const rates = await getExchangeRates();

    const result = [];

    for (const p of products) {
      const listings = await query(
        `SELECT r.*, s.name as supplier_name, s.currency_default, s.reliability_score, s.avg_delivery_days, s.warranty_terms_default
         FROM raw_listings r
         JOIN suppliers s ON r.supplier_id = s.id
         WHERE r.canonical_product_id = ?`,
        [p.id]
      );

      const offers = listings.map((l) => {
        const rate = rates[l.parsed_currency] || 129.50;
        const priceInBase = l.parsed_price * rate;
        const supplier = suppliers.find((s) => s.id === l.supplier_id) || {};
        return {
          id: `off_${l.id}`,
          canonical_product_id: p.id,
          supplier_id: l.supplier_id,
          supplier_name: l.supplier_name,
          raw_listing_id: l.id,
          raw_name: l.raw_name,
          sku: l.raw_sku,
          price: l.parsed_price,
          currency: l.parsed_currency,
          price_in_base_currency: priceInBase,
          stock_qty: l.parsed_stock_qty || 0,
          stock_status: l.parsed_stock_status,
          specs: l.raw_specs,
          supplier
        };
      });

      // Calculate Sourcing Scores for each offer
      let recommendedOffer = null;
      let highestScore = -1;

      offers.forEach((o) => {
        const scoreInfo = calculateSupplierScore(o, offers, o.supplier);
        o.scoreInfo = scoreInfo;
        if (scoreInfo.totalScore > highestScore) {
          highestScore = scoreInfo.totalScore;
          recommendedOffer = o;
        }
      });

      // Price History sparkline points
      const history = await query(
        `SELECT recorded_at, price_in_base_currency, supplier_id FROM price_histories WHERE canonical_product_id = ? ORDER BY recorded_at ASC LIMIT 10`,
        [p.id]
      );

      result.push({
        ...p,
        attributes: typeof p.attributes === 'string' ? JSON.parse(p.attributes || '{}') : (p.attributes || {}),
        offers,
        recommendedOffer,
        priceHistory: history
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. GET Match Review Queue
router.get('/match-suggestions', async (req, res) => {
  try {
    const suggestions = await query(
      `SELECT m.*, 
              ra.raw_name as listing_a_name, ra.raw_sku as listing_a_sku, ra.parsed_price as listing_a_price, ra.parsed_currency as listing_a_curr, sa.name as supplier_a_name,
              rb.raw_name as listing_b_name, rb.raw_sku as listing_b_sku, rb.parsed_price as listing_b_price, rb.parsed_currency as listing_b_curr, sb.name as supplier_b_name,
              cp.canonical_name
       FROM match_suggestions m
       JOIN raw_listings ra ON m.raw_listing_a_id = ra.id
       LEFT JOIN raw_listings rb ON m.raw_listing_b_id = rb.id
       LEFT JOIN suppliers sa ON ra.supplier_id = sa.id
       LEFT JOIN suppliers sb ON rb.supplier_id = sb.id
       LEFT JOIN canonical_products cp ON m.canonical_product_id = cp.id
       WHERE m.status = 'pending'
       ORDER BY m.similarity_score DESC`
    );

    const formatted = suggestions.map((s) => ({
      ...s,
      matching_signals: typeof s.matching_signals === 'string' ? JSON.parse(s.matching_signals || '{}') : (s.matching_signals || {})
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Approve Match Suggestion
router.post('/match-suggestions/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const sug = await get(`SELECT * FROM match_suggestions WHERE id = ?`, [id]);
    if (!sug) return res.status(404).json({ error: 'Match suggestion not found' });

    let cpId = sug.canonical_product_id;
    if (!cpId) {
      cpId = `cp_${Date.now()}`;
      const listingA = await get(`SELECT * FROM raw_listings WHERE id = ?`, [sug.raw_listing_a_id]);
      await run(`INSERT INTO canonical_products (id, canonical_name) VALUES (?, ?)`, [cpId, listingA.raw_name]);
    }

    await run(`UPDATE raw_listings SET canonical_product_id = ?, match_status = 'confirmed' WHERE id = ?`, [cpId, sug.raw_listing_a_id]);
    if (sug.raw_listing_b_id) {
      await run(`UPDATE raw_listings SET canonical_product_id = ?, match_status = 'confirmed' WHERE id = ?`, [cpId, sug.raw_listing_b_id]);
    }

    await run(`UPDATE match_suggestions SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
    await run(`INSERT INTO audit_logs (id, action, entity_type, entity_id, after) VALUES (?, 'APPROVE_MATCH', 'match_suggestion', ?, ?)`,
      [`aud_${Date.now()}`, id, JSON.stringify({ canonical_product_id: cpId })]);

    res.json({ success: true, canonical_product_id: cpId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Reject Match Suggestion
router.post('/match-suggestions/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    await run(`UPDATE match_suggestions SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Merge Canonical Products
router.post('/products/merge', async (req, res) => {
  try {
    const { targetProductId, sourceProductId } = req.body;
    await run(`UPDATE raw_listings SET canonical_product_id = ? WHERE canonical_product_id = ?`, [targetProductId, sourceProductId]);
    await run(`UPDATE canonical_products SET merged_into_id = ? WHERE id = ?`, [targetProductId, sourceProductId]);
    await run(`INSERT INTO audit_logs (id, action, entity_type, entity_id, before, after) VALUES (?, 'MERGE_PRODUCTS', 'canonical_product', ?, ?, ?)`,
      [`aud_${Date.now()}`, targetProductId, JSON.stringify({ sourceProductId }), JSON.stringify({ targetProductId })]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Split Raw Listing from Canonical Product
router.post('/products/split', async (req, res) => {
  try {
    const { rawListingId } = req.body;
    const listing = await get(`SELECT * FROM raw_listings WHERE id = ?`, [rawListingId]);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const newCpId = `cp_${Date.now()}`;
    await run(`INSERT INTO canonical_products (id, canonical_name) VALUES (?, ?)`, [newCpId, listing.raw_name]);
    await run(`UPDATE raw_listings SET canonical_product_id = ? WHERE id = ?`, [newCpId, rawListingId]);
    res.json({ success: true, newCanonicalProductId: newCpId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. GET & POST Suppliers
router.get('/suppliers', async (req, res) => {
  try {
    const suppliers = await query(`SELECT * FROM suppliers ORDER BY name ASC`);
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/suppliers', async (req, res) => {
  try {
    const { name, contact_info, currency_default, reliability_score, avg_delivery_days, warranty_terms_default } = req.body;
    const id = `sup_${Date.now()}`;
    await run(
      `INSERT INTO suppliers (id, name, contact_info, currency_default, reliability_score, avg_delivery_days, warranty_terms_default)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name, contact_info || '', currency_default || 'USD', reliability_score || 8.0, avg_delivery_days || 3, warranty_terms_default || '1 Year Warranty']
    );
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. GET & POST Exchange Rates
router.get('/exchange-rates', async (req, res) => {
  try {
    const rates = await query(`SELECT * FROM exchange_rates ORDER BY currency_code ASC`);
    res.json(rates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/exchange-rates', async (req, res) => {
  try {
    const { currency_code, rate_to_base } = req.body;
    await setExchangeRate(currency_code, parseFloat(rate_to_base));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Admin Settings & Formula Weights
router.get('/admin/settings', async (req, res) => {
  try {
    const weights = getScoringWeights();
    const auditLogs = await query(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 20`);
    res.json({ scoringWeights: weights, auditLogs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/settings', async (req, res) => {
  try {
    const { scoringWeights } = req.body;
    if (scoringWeights) {
      updateScoringWeights(scoringWeights);
    }
    res.json({ success: true, scoringWeights: getScoringWeights() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Purchase Order Batch Draft Generator
router.post('/purchase-orders/draft', async (req, res) => {
  try {
    const products = await query(`SELECT * FROM canonical_products WHERE merged_into_id IS NULL`);
    const suppliers = await query(`SELECT * FROM suppliers`);
    const rates = await getExchangeRates();

    const poGroups = {};

    for (const p of products) {
      const listings = await query(
        `SELECT r.*, s.name as supplier_name, s.reliability_score, s.avg_delivery_days, s.warranty_terms_default
         FROM raw_listings r
         JOIN suppliers s ON r.supplier_id = s.id
         WHERE r.canonical_product_id = ?`,
        [p.id]
      );

      if (!listings.length) continue;

      const offers = listings.map((l) => {
        const rate = rates[l.parsed_currency] || 129.50;
        const supplier = suppliers.find((s) => s.id === l.supplier_id) || {};
        return {
          id: l.id,
          canonical_product_id: p.id,
          canonical_name: p.canonical_name,
          supplier_id: l.supplier_id,
          supplier_name: l.supplier_name,
          sku: l.raw_sku,
          price: l.parsed_price,
          currency: l.parsed_currency,
          price_in_base_currency: l.parsed_price * rate,
          stock_qty: l.parsed_stock_qty || 0,
          stock_status: l.parsed_stock_status,
          supplier
        };
      });

      let recOffer = null;
      let maxScore = -1;

      offers.forEach((o) => {
        const scoreInfo = calculateSupplierScore(o, offers, o.supplier);
        if (scoreInfo.totalScore > maxScore) {
          maxScore = scoreInfo.totalScore;
          recOffer = o;
        }
      });

      if (recOffer) {
        if (!poGroups[recOffer.supplier_id]) {
          poGroups[recOffer.supplier_id] = {
            supplier: recOffer.supplier,
            items: []
          };
        }
        poGroups[recOffer.supplier_id].items.push(recOffer);
      }
    }

    res.json(Object.values(poGroups));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 11. POST Ingestion Endpoint
router.post('/imports', async (req, res) => {
  try {
    const { supplier_name, currency, items } = req.body;
    let supplier = await get(`SELECT * FROM suppliers WHERE LOWER(name) = LOWER(?)`, [supplier_name.trim()]);
    if (!supplier) {
      const supId = `sup_${Date.now()}`;
      await run(`INSERT INTO suppliers (id, name, currency_default) VALUES (?, ?, ?)`, [supId, supplier_name.trim(), currency || 'USD']);
      supplier = await get(`SELECT * FROM suppliers WHERE id = ?`, [supId]);
    }

    const importId = `imp_${Date.now()}`;
    await run(`INSERT INTO supplier_imports (id, supplier_id, file_name, raw_row_count) VALUES (?, ?, 'Injected Import', ?)`,
      [importId, supplier.id, items.length]);

    const createdListingIds = [];
    for (const item of items) {
      const rlId = `rl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await run(
        `INSERT INTO raw_listings (id, supplier_import_id, supplier_id, raw_name, raw_sku, raw_price, raw_currency, raw_stock_text, parsed_price, parsed_currency, parsed_stock_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rlId, importId, supplier.id,
          item.name, item.sku || '', item.price, currency || 'USD', item.stockRaw || 'In Stock',
          item.price, currency || 'USD', 'in_stock'
        ]
      );
      createdListingIds.push(rlId);
      await processListingMatching(rlId);
    }

    res.json({ success: true, importId, count: createdListingIds.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
