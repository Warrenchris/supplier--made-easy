import assert from 'node:assert/strict';
import { normalizeListing, calculateSimilarity } from '../server/productIdentityEngine.js';
import { calculateSupplierIntelligence } from '../server/scoringEngine.js';
import { calculateRetailPrice, getPublicProductFeed } from '../server/storefrontSync.js';
import { initDb, getStore } from '../server/db.js';
import { productRepo, offerRepo, priceObservationRepo } from '../server/repositories/index.js';
import { optimizeProcurement } from '../server/procurementOptimizer.js';
import { calculatePriceTrend } from '../server/priceTrendEngine.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  SUPPLIER MADE EASY — ADVERSARIAL VALIDATION SUITE v3.1');
console.log('═══════════════════════════════════════════════════════════════\n');

// ─── 1. PRODUCT MATCHING FALSE-POSITIVE TESTS ────────────────────────────────

console.log('▶ 1. Product Identity & Matching Validation');

test('Differentiates 990 EVO from 990 EVO PLUS (no false positive)', () => {
  const normEVO = normalizeListing({ raw_name: 'Samsung 990 EVO 1TB NVMe SSD', raw_sku: 'MZ-V9E1T0BW' });
  const normEVOPlus = normalizeListing({ raw_name: 'Samsung 990 EVO+ 1TB PCIe 4.0 M.2 SSD', raw_sku: 'MZ-V9S1T0BW' });

  assert.equal(normEVO.model, '990 EVO');
  assert.equal(normEVOPlus.model, '990 EVO PLUS');

  const canonicalEVOPlus = {
    brand: 'SAMSUNG',
    model_number: '990 EVO PLUS',
    specifications: { capacity: '1TB' },
    identifiers: { mpn: 'MZV9S1T0BW' }
  };

  const similarity = calculateSimilarity(normEVO, canonicalEVOPlus);
  // Confidence must be LOW (< 0.50) so it NEVER auto-confirms or wrongly matches
  assert.ok(similarity.confidence < 0.50, `Expected low confidence for 990 EVO vs 990 EVO PLUS, got ${similarity.confidence}`);
});

test('Differentiates 990 PRO from 990 EVO PLUS', () => {
  const normPRO = normalizeListing({ raw_name: 'Samsung 990 PRO 1TB PCIe 4.0 M.2 NVMe SSD', raw_sku: 'MZ-V9P1T0BW' });
  assert.equal(normPRO.model, '990 PRO');

  const canonicalEVOPlus = {
    brand: 'SAMSUNG',
    model_number: '990 EVO PLUS',
    specifications: { capacity: '1TB' }
  };

  const similarity = calculateSimilarity(normPRO, canonicalEVOPlus);
  assert.ok(similarity.confidence < 0.50, `Expected <0.50 for PRO vs EVO PLUS, got ${similarity.confidence}`);
});

test('Correctly matches wildly formatted identical listings', () => {
  const listingA = normalizeListing({ raw_name: 'SAMSUNG SSD 1TB NVME 990 EVO PLUS', raw_sku: 'MZ-V9S1T0BW' });
  const canonical = {
    brand: 'SAMSUNG',
    model_number: '990 EVO PLUS',
    specifications: { capacity: '1TB' },
    identifiers: { mpn: 'MZV9S1T0BW' }
  };

  const simA = calculateSimilarity(listingA, canonical);
  assert.ok(simA.confidence >= 0.80, `Expected high confidence for identical item, got ${simA.confidence}`);

  // Test 990 EVO+ syntax
  const listingB = normalizeListing({ raw_name: 'Samsung 990 EVO+ 1TB M.2', raw_sku: 'MZV9S1T0BW' });
  const simB = calculateSimilarity(listingB, canonical);
  assert.ok(simB.confidence >= 0.80, `Expected >=0.80 for 990 EVO+ syntax, got ${simB.confidence}`);
});

test('Strictly rejects conflicting capacity (1TB vs 2TB)', () => {
  const listing2TB = normalizeListing({ raw_name: 'Samsung 990 EVO Plus 2TB NVMe', raw_sku: 'MZ-V9S2T0BW' });
  const canonical1TB = {
    brand: 'SAMSUNG',
    model_number: '990 EVO PLUS',
    specifications: { capacity: '1TB' }
  };

  const sim = calculateSimilarity(listing2TB, canonical1TB);
  assert.ok(sim.confidence <= 0.20, `Expected <=0.20 for capacity mismatch, got ${sim.confidence}`);
});

// ─── 2. OPTIMIZER EDGE CASES ────────────────────────────────────────────────

console.log('\n▶ 2. Multi-Supplier Optimizer Edge Cases');

await asyncTest('Multi-way split: 20 units across 3 suppliers (7 + 6 + 7 = 20)', async () => {
  await initDb();
  const store = getStore();

  // Create isolated test product
  const testProd = await productRepo.create({
    canonical_name: 'Test Adversarial Widget 100X',
    brand: 'TEST',
    category: 'Electronics',
    model_number: 'WIDGET-100X'
  });

  // Setup 3 suppliers with capped inventory: 7, 6, 7 (total = 20)
  const sA = 'sup_adv_a', sB = 'sup_adv_b', sC = 'sup_adv_c';
  store.suppliers.push(
    { id: sA, name: 'Supplier A (Cheap, 7 units)', reliability_score: 9.0, avg_delivery_days: 2 },
    { id: sB, name: 'Supplier B (Mid, 6 units)', reliability_score: 8.5, avg_delivery_days: 2 },
    { id: sC, name: 'Supplier C (High, 7 units)', reliability_score: 8.0, avg_delivery_days: 2 }
  );

  await offerRepo.upsert({
    canonical_product_id: testProd.id, supplier_id: sA, cost: 100, currency: 'KES', cost_in_base_currency: 100,
    quantity_available: 7, stock_status: 'in_stock'
  });
  await offerRepo.upsert({
    canonical_product_id: testProd.id, supplier_id: sB, cost: 110, currency: 'KES', cost_in_base_currency: 110,
    quantity_available: 6, stock_status: 'in_stock'
  });
  await offerRepo.upsert({
    canonical_product_id: testProd.id, supplier_id: sC, cost: 120, currency: 'KES', cost_in_base_currency: 120,
    quantity_available: 7, stock_status: 'in_stock'
  });

  const result = await optimizeProcurement(testProd.id, 20, 'lowest_cost');

  assert.equal(result.success, true);
  assert.equal(result.allocations.length, 3, 'Must allocate across all 3 suppliers');

  const allocatedTotal = result.allocations.reduce((sum, a) => sum + a.quantity, 0);
  assert.equal(allocatedTotal, 20, 'Total allocated quantity must equal requested (20)');

  assert.equal(result.allocations[0].quantity, 7);
  assert.equal(result.allocations[1].quantity, 6);
  assert.equal(result.allocations[2].quantity, 7);

  // Total cost: (7*100) + (6*110) + (7*120) = 700 + 660 + 840 = 2200
  assert.equal(result.totalCost, 2200);
});

await asyncTest('Insufficient stock: Requested 20, available 17 -> Explicit error', async () => {
  const store = getStore();

  const testProd = await productRepo.create({
    canonical_name: 'Scarce Stock Item',
    brand: 'TEST',
    category: 'Electronics'
  });

  // Only 17 available total
  await offerRepo.upsert({
    canonical_product_id: testProd.id, supplier_id: 'sup_adv_a', cost: 100, currency: 'KES', cost_in_base_currency: 100,
    quantity_available: 10, stock_status: 'in_stock'
  });
  await offerRepo.upsert({
    canonical_product_id: testProd.id, supplier_id: 'sup_adv_b', cost: 110, currency: 'KES', cost_in_base_currency: 110,
    quantity_available: 7, stock_status: 'in_stock'
  });

  const result = await optimizeProcurement(testProd.id, 20, 'best_value');

  assert.equal(result.success, false, 'Must fail when stock is insufficient');
  assert.ok(result.error.includes('Insufficient total stock'), 'Must explicitly mention insufficient stock');
  assert.ok(result.reasoning.some((r) => r.includes('Shortfall: 3 units')), 'Must report exact shortfall');
});

// ─── 3. PRICING STRATEGY AUDIT ──────────────────────────────────────────────

console.log('\n▶ 3. Pricing Strategy Mathematics & Guardrails');

test('Markup formula: Cost 10,000 @ 30% markup = 13,000', () => {
  const retail = calculateRetailPrice(10000, 'markup', { rate: 0.30 });
  assert.equal(retail, 13000);
});

test('Gross margin formula: Cost 10,000 @ 30% margin = 14,286', () => {
  const retail = calculateRetailPrice(10000, 'gross_margin', { rate: 0.30 });
  assert.equal(retail, 14286);
});

test('Fixed price formula: returns fixed amount', () => {
  const retail = calculateRetailPrice(10000, 'fixed_price', { fixedPrice: 14999 });
  assert.equal(retail, 14999);
});

test('Cost + fixed amount: Cost 10,000 + 4,000 = 14,000', () => {
  const retail = calculateRetailPrice(10000, 'cost_plus_fixed', { fixedAmount: 4000 });
  assert.equal(retail, 14000);
});

// ─── 4. REALMER SECURITY BOUNDARY ───────────────────────────────────────────

console.log('\n▶ 4. Realmer Public Feed Security Boundary');

await asyncTest('Public storefront feed contains zero sensitive economic fields', async () => {
  const publicFeed = await getPublicProductFeed();

  assert.ok(publicFeed.length > 0, 'Public feed should have products');

  const forbiddenFields = [
    'acquisitionCost', 'acquisition_cost', 'cost', 'supplier', 'supplier_id',
    'supplierId', 'supplierName', 'margin', 'grossMargin', 'profit', 'unitProfit',
    'pricingStrategy', 'supplierScore'
  ];

  for (const item of publicFeed) {
    for (const field of forbiddenFields) {
      assert.equal(
        item[field],
        undefined,
        `SECURITY VIOLATION: Public product '${item.name}' exposed sensitive field '${field}'!`
      );
    }

    // Must have public-safe fields
    assert.ok(item.productId, 'Must have productId');
    assert.ok(item.name, 'Must have name');
    assert.ok(item.price > 0, 'Must have positive retail price');
    assert.ok(item.availability, 'Must have availability');
  }
});

// ─── 5. PRICE HISTORY & CONFIDENCE TIERS ────────────────────────────────────

console.log('\n▶ 5. Price History & Confidence Tiers');

await asyncTest('Confidence transitions correctly based on observation count', async () => {
  const testProd = await productRepo.create({ canonical_name: 'Trend Test Product' });
  const supId = 'sup_trend_test';

  // 1 Observation -> low confidence
  await priceObservationRepo.record({
    supplier_id: supId, canonical_product_id: testProd.id, price_in_base_currency: 10000,
    captured_at: new Date(Date.now() - 2 * 86400000).toISOString()
  });

  const trend1 = await calculatePriceTrend(testProd.id, supId);
  assert.equal(trend1.trend7d.confidence, 'low', '1 observation should be low confidence');

  // Add 2 more (total 3) -> medium confidence
  await priceObservationRepo.record({
    supplier_id: supId, canonical_product_id: testProd.id, price_in_base_currency: 10200,
    captured_at: new Date(Date.now() - 4 * 86400000).toISOString()
  });
  await priceObservationRepo.record({
    supplier_id: supId, canonical_product_id: testProd.id, price_in_base_currency: 10500,
    captured_at: new Date(Date.now() - 6 * 86400000).toISOString()
  });

  const trend3 = await calculatePriceTrend(testProd.id, supId);
  assert.equal(trend3.trend7d.confidence, 'medium', '3 observations should be medium confidence');

  // Add 2 more (total 5) -> high confidence
  await priceObservationRepo.record({
    supplier_id: supId, canonical_product_id: testProd.id, price_in_base_currency: 10100,
    captured_at: new Date(Date.now() - 1 * 86400000).toISOString()
  });
  await priceObservationRepo.record({
    supplier_id: supId, canonical_product_id: testProd.id, price_in_base_currency: 10000,
    captured_at: new Date().toISOString()
  });

  const trend5 = await calculatePriceTrend(testProd.id, supId);
  assert.equal(trend5.trend7d.confidence, 'high', '5 observations should be high confidence');
});

// ─── SUMMARY ────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════════════════════════\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 All adversarial validation tests passed cleanly!\n');
  process.exit(0);
}
