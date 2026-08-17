import express from 'express';
import { query, run, get } from './db.js';
import { processListing } from './productIdentityEngine.js';
import { convertToBaseCurrency, getExchangeRates, setExchangeRate } from './fxService.js';
import { getScoringWeights, updateScoringWeights, calculateSupplierIntelligence } from './scoringEngine.js';
import { optimizeProcurement } from './procurementOptimizer.js';
import { calculatePriceTrend, getProductTrends } from './priceTrendEngine.js';
import { getPublicProductFeed, getInternalEconomicsFeed, getStorefrontSettings, updateStorefrontSettings, calculateRetailPrice } from './storefrontSync.js';
import { productRepo, offerRepo, supplierRepo, priceObservationRepo, procurementDecisionRepo } from './repositories/index.js';

const router = express.Router();

// ─── Health Check ───────────────────────────────────────────────────────────

router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: Math.round(process.uptime()),
    version: '3.0.0',
    timestamp: new Date().toISOString()
  });
});

// ─── Canonical Products with Supplier Offers & Scoring ──────────────────────

router.get('/canonical-products', async (req, res) => {
  try {
    const products = await productRepo.findAll({ excludeMerged: true });
    const suppliers = await supplierRepo.findAll();
    const rates = await getExchangeRates();

    const result = [];

    for (const p of products) {
      const offers = await offerRepo.findByProduct(p.id);

      // If no first-class offers, fall back to raw_listings (legacy compatibility)
      let enrichedOffers = offers;
      if (!offers.length) {
        const listings = await query(
          `SELECT r.*, s.name as supplier_name, s.currency_default, s.reliability_score, s.avg_delivery_days, s.warranty_terms_default
           FROM raw_listings r
           JOIN suppliers s ON r.supplier_id = s.id
           WHERE r.canonical_product_id = ?`,
          [p.id]
        );
        enrichedOffers = listings.map((l) => {
          const rate = rates[l.parsed_currency] || 129.50;
          const supplier = suppliers.find((s) => s.id === l.supplier_id) || {};
          return {
            id: `off_${l.id}`,
            canonical_product_id: p.id,
            supplier_id: l.supplier_id,
            supplier_name: l.supplier_name,
            raw_listing_id: l.id,
            supplier_name: l.raw_name,
            supplier_sku: l.raw_sku,
            cost: l.parsed_price,
            currency: l.parsed_currency,
            cost_in_base_currency: l.parsed_price * rate,
            quantity_available: l.parsed_stock_qty || 0,
            stock_status: l.parsed_stock_status,
            warranty_terms: supplier.warranty_terms_default || '',
            supplier
          };
        });
      }

      // Calculate intelligence scores for each offer
      let recommendedOffer = null;
      let highestScore = -1;

      enrichedOffers.forEach((o) => {
        const supplier = o.supplier || suppliers.find((s) => s.id === o.supplier_id) || {};
        const scoreInfo = calculateSupplierIntelligence(o, enrichedOffers, supplier);
        o.scoreInfo = scoreInfo;
        if (scoreInfo.totalScore > highestScore) {
          highestScore = scoreInfo.totalScore;
          recommendedOffer = o;
        }
      });

      // Price history
      const observations = await priceObservationRepo.getAllForProduct(p.id);

      const specs = typeof p.specifications === 'string'
        ? JSON.parse(p.specifications || '{}')
        : (p.specifications || {});
      const attrs = typeof p.attributes === 'string'
        ? JSON.parse(p.attributes || '{}')
        : (p.attributes || {});

      result.push({
        ...p,
        specifications: specs,
        attributes: attrs,
        offers: enrichedOffers,
        recommendedOffer,
        priceHistory: observations.slice(-20)
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Match Review Queue ─────────────────────────────────────────────────────

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

router.post('/match-suggestions/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const sug = await get(`SELECT * FROM match_suggestions WHERE id = ?`, [id]);
    if (!sug) return res.status(404).json({ error: 'Match suggestion not found' });

    let cpId = sug.canonical_product_id;
    if (!cpId) {
      const listingA = await get(`SELECT * FROM raw_listings WHERE id = ?`, [sug.raw_listing_a_id]);
      const newProduct = await productRepo.create({ canonical_name: listingA.raw_name });
      cpId = newProduct.id;
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

router.post('/match-suggestions/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    await run(`UPDATE match_suggestions SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Product Merge / Split ──────────────────────────────────────────────────

router.post('/products/merge', async (req, res) => {
  try {
    const { targetProductId, sourceProductId } = req.body;
    await productRepo.merge(targetProductId, sourceProductId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/products/split', async (req, res) => {
  try {
    const { rawListingId } = req.body;
    const newProduct = await productRepo.split(rawListingId);
    res.json({ success: true, newCanonicalProductId: newProduct.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Suppliers ──────────────────────────────────────────────────────────────

router.get('/suppliers', async (req, res) => {
  try {
    const suppliers = await supplierRepo.findAll();
    // Enrich with last import date
    const enriched = [];
    for (const s of suppliers) {
      const lastImport = await supplierRepo.getLastImportDate(s.id);
      enriched.push({ ...s, lastImportDate: lastImport });
    }
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/suppliers', async (req, res) => {
  try {
    const supplier = await supplierRepo.create(req.body);
    res.json({ success: true, id: supplier.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Exchange Rates ─────────────────────────────────────────────────────────

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

// ─── Admin Settings & Scoring Weights ───────────────────────────────────────

router.get('/admin/settings', async (req, res) => {
  try {
    const weights = getScoringWeights();
    const auditLogs = await query(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 20`);
    const storefrontSettings = getStorefrontSettings();
    res.json({ scoringWeights: weights, auditLogs, storefrontSettings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/settings', async (req, res) => {
  try {
    const { scoringWeights, storefrontSettings } = req.body;
    if (scoringWeights) updateScoringWeights(scoringWeights);
    if (storefrontSettings) updateStorefrontSettings(storefrontSettings);
    res.json({
      success: true,
      scoringWeights: getScoringWeights(),
      storefrontSettings: getStorefrontSettings()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Procurement Optimizer ──────────────────────────────────────────────────

router.post('/procurement/optimize', async (req, res) => {
  try {
    const { canonicalProductId, quantity, mode } = req.body;
    if (!canonicalProductId || !quantity) {
      return res.status(400).json({ error: 'canonicalProductId and quantity are required' });
    }
    const result = await optimizeProcurement(canonicalProductId, parseInt(quantity), mode || 'best_value');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Procurement Decisions ──────────────────────────────────────────────────

router.post('/procurement/decide', async (req, res) => {
  try {
    const { canonicalProductId, quantity, mode, orderId } = req.body;
    if (!canonicalProductId || !quantity) {
      return res.status(400).json({ error: 'canonicalProductId and quantity are required' });
    }

    // Run optimizer
    const optimization = await optimizeProcurement(canonicalProductId, parseInt(quantity), mode || 'best_value');

    if (!optimization.success) {
      return res.status(400).json({ error: optimization.error, reasoning: optimization.reasoning });
    }

    // Save immutable decision snapshot
    const decision = await procurementDecisionRepo.create({
      order_id: orderId || null,
      canonical_product_id: canonicalProductId,
      requested_quantity: parseInt(quantity),
      optimization_mode: mode || 'best_value',
      allocations: optimization.allocations,
      total_acquisition_cost: optimization.totalCost,
      supplier_scores_snapshot: optimization.allocations.map((a) => ({
        supplier: a.supplier,
        score: a.score,
        quantity: a.quantity
      })),
      status: 'draft'
    });

    res.json({ success: true, decision, optimization });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/procurement/decisions', async (req, res) => {
  try {
    const decisions = await procurementDecisionRepo.findAll();
    res.json(decisions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/procurement/decisions/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await procurementDecisionRepo.updateStatus(req.params.id, status);
    res.json({ success: true, decision: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Price Trends ───────────────────────────────────────────────────────────

router.get('/price-trends', async (req, res) => {
  try {
    const { productId, supplierId } = req.query;
    if (!productId) {
      return res.status(400).json({ error: 'productId query parameter is required' });
    }
    if (supplierId) {
      const trend = await calculatePriceTrend(productId, supplierId);
      res.json(trend);
    } else {
      const trends = await getProductTrends(productId);
      res.json(trends);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Storefront Sync ────────────────────────────────────────────────────────

router.get('/storefront/products', async (req, res) => {
  try {
    const feed = await getPublicProductFeed();
    res.json(feed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/internal/storefront-economics', async (req, res) => {
  try {
    const feed = await getInternalEconomicsFeed();
    res.json(feed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/storefront/settings', async (req, res) => {
  try {
    const updated = updateStorefrontSettings(req.body);
    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Purchase Order Batch Draft ─────────────────────────────────────────────

router.post('/purchase-orders/draft', async (req, res) => {
  try {
    const products = await productRepo.findAll({ excludeMerged: true });
    const suppliers = await supplierRepo.findAll();

    const poGroups = {};

    for (const p of products) {
      const offers = await offerRepo.findByProduct(p.id);
      if (!offers.length) continue;

      let recOffer = null;
      let maxScore = -1;

      offers.forEach((o) => {
        const supplier = o.supplier || suppliers.find((s) => s.id === o.supplier_id) || {};
        const scoreInfo = calculateSupplierIntelligence(o, offers, supplier);
        if (scoreInfo.totalScore > maxScore) {
          maxScore = scoreInfo.totalScore;
          recOffer = { ...o, supplier };
        }
      });

      if (recOffer) {
        if (!poGroups[recOffer.supplier_id]) {
          poGroups[recOffer.supplier_id] = {
            supplier: recOffer.supplier,
            items: []
          };
        }
        poGroups[recOffer.supplier_id].items.push({
          productId: p.id,
          productName: p.canonical_name,
          sku: recOffer.supplier_sku,
          cost: recOffer.cost,
          currency: recOffer.currency,
          costInKES: recOffer.cost_in_base_currency
        });
      }
    }

    res.json(Object.values(poGroups));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Data Ingestion ─────────────────────────────────────────────────────────

router.post('/imports', async (req, res) => {
  try {
    const { supplier_name, currency, items } = req.body;

    let supplier = await supplierRepo.findByName(supplier_name.trim());
    if (!supplier) {
      supplier = await supplierRepo.create({
        name: supplier_name.trim(),
        currency_default: currency || 'USD'
      });
    }

    const importId = `imp_${Date.now()}`;
    await run(`INSERT INTO supplier_imports (id, supplier_id, file_name, raw_row_count) VALUES (?, ?, 'Ingested Import', ?)`,
      [importId, supplier.id, items.length]);

    const createdListingIds = [];
    for (const item of items) {
      const rlId = `rl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await run(
        `INSERT INTO raw_listings (id, supplier_import_id, supplier_id, raw_name, raw_sku, raw_price, raw_currency, raw_stock_text, parsed_price, parsed_currency, parsed_stock_status, parsed_stock_qty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rlId, importId, supplier.id,
          item.name, item.sku || '', item.price, currency || 'USD', item.stockRaw || 'In Stock',
          item.price, currency || 'USD', 'in_stock', parseInt(item.stockQty) || 0
        ]
      );
      createdListingIds.push(rlId);

      // Process through Product Identity Engine
      await processListing(rlId);
    }

    res.json({ success: true, importId, count: createdListingIds.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
