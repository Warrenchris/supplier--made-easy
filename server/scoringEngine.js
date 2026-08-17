import { getStore } from './db.js';
import * as supplierRepo from './repositories/supplierRepository.js';

/**
 * Supplier Intelligence Scoring Engine — 6-Metric Explainable Radar
 *
 * Each metric returns both a score (0-100) and a human-readable explanation.
 * Metrics: Price Competitiveness, Stock Availability, Reliability,
 *          Warranty, Delivery Speed, Data Freshness
 */

let scoringWeights = {
  w1_price: 0.30,
  w2_stock: 0.20,
  w3_reliability: 0.20,
  w4_delivery: 0.10,
  w5_warranty: 0.10,
  w6_freshness: 0.10
};

export function getScoringWeights() {
  return { ...scoringWeights };
}

export function updateScoringWeights(newWeights) {
  scoringWeights = { ...scoringWeights, ...newWeights };
  return { ...scoringWeights };
}

/**
 * Calculate full 6-metric supplier intelligence for a single offer.
 *
 * @param {Object} offer - The supplier offer being evaluated
 * @param {Object[]} allOffers - All competing offers for the same canonical product
 * @param {Object} supplier - The supplier entity
 * @param {Object} options - Additional context (priceObservations, etc.)
 * @returns {Object} totalScore + explainable metrics breakdown
 */
export function calculateSupplierIntelligence(offer, allOffers, supplier, options = {}) {
  const weights = getScoringWeights();
  const metrics = {};

  // ── 1. Price Competitiveness ──────────────────────────────────────────────
  const prices = allOffers.map((o) => o.cost_in_base_currency || o.price_in_base_currency).filter((p) => p > 0);
  const minPrice = prices.length ? Math.min(...prices) : (offer.cost_in_base_currency || 0);
  const maxPrice = prices.length ? Math.max(...prices) : (offer.cost_in_base_currency || 0);
  const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const offerPrice = offer.cost_in_base_currency || offer.price_in_base_currency || 0;

  let priceRawScore = 100;
  if (maxPrice > minPrice) {
    priceRawScore = Math.round(100 - ((offerPrice - minPrice) / (maxPrice - minPrice)) * 50);
  }
  priceRawScore = Math.max(0, Math.min(100, priceRawScore));

  let priceExplanation;
  if (avgPrice > 0 && offerPrice > 0) {
    const pctDiff = Math.round(((avgPrice - offerPrice) / avgPrice) * 100);
    if (pctDiff > 0) {
      priceExplanation = `${pctDiff}% cheaper than supplier average`;
    } else if (pctDiff < 0) {
      priceExplanation = `${Math.abs(pctDiff)}% more expensive than supplier average`;
    } else {
      priceExplanation = `At supplier average price`;
    }
  } else {
    priceExplanation = 'Only supplier for this product';
  }

  metrics.price = { score: priceRawScore, explanation: priceExplanation };

  // ── 2. Stock Availability ─────────────────────────────────────────────────
  const stockQty = offer.quantity_available || offer.stock_qty || 0;
  const stockStatus = offer.stock_status || 'unknown';
  let stockRawScore = 20;
  let stockExplanation;

  if (stockStatus === 'in_stock') {
    if (stockQty >= 50) { stockRawScore = 100; stockExplanation = `${stockQty} units in stock`; }
    else if (stockQty >= 20) { stockRawScore = 90; stockExplanation = `${stockQty} units in stock`; }
    else if (stockQty >= 10) { stockRawScore = 80; stockExplanation = `${stockQty} units in stock`; }
    else if (stockQty > 0) { stockRawScore = 65; stockExplanation = `Low stock: ${stockQty} units`; }
    else { stockRawScore = 60; stockExplanation = 'In stock (quantity unknown)'; }
  } else if (stockStatus === 'low_stock') {
    stockRawScore = 40; stockExplanation = `Low stock: ${stockQty} units remaining`;
  } else if (stockStatus === 'backorder') {
    stockRawScore = 25; stockExplanation = 'On backorder';
  } else if (stockStatus === 'out_of_stock') {
    stockRawScore = 0; stockExplanation = 'Out of stock';
  } else {
    stockExplanation = 'Stock status unknown';
  }

  metrics.stock = { score: stockRawScore, explanation: stockExplanation };

  // ── 3. Supplier Reliability ───────────────────────────────────────────────
  const reliabilityRaw = (supplier.reliability_score || 8.0);
  const reliabilityScore = Math.round(reliabilityRaw * 10);
  const reliabilityExplanation = reliabilityRaw >= 9.0
    ? `${reliabilityRaw}/10 reliability — excellent track record`
    : reliabilityRaw >= 7.0
      ? `${reliabilityRaw}/10 reliability — good track record`
      : `${reliabilityRaw}/10 reliability — needs improvement`;

  metrics.reliability = { score: Math.min(100, reliabilityScore), explanation: reliabilityExplanation };

  // ── 4. Warranty Terms ─────────────────────────────────────────────────────
  const warrantyText = String(offer.warranty_terms || supplier.warranty_terms_default || "").toLowerCase();
  let warrantyScore = 50;
  let warrantyExplanation = 'No warranty information';

  if (warrantyText.includes('3 year') || warrantyText.includes('36 month')) {
    warrantyScore = 100; warrantyExplanation = '36-month manufacturer warranty';
  } else if (warrantyText.includes('2 year') || warrantyText.includes('24 month')) {
    warrantyScore = 90; warrantyExplanation = '24-month manufacturer warranty';
  } else if (warrantyText.includes('1 year') || warrantyText.includes('12 month')) {
    warrantyScore = 80; warrantyExplanation = '12-month manufacturer warranty';
  } else if (warrantyText.includes('6 month')) {
    warrantyScore = 60; warrantyExplanation = '6-month warranty';
  } else if (warrantyText.includes('90 day') || warrantyText.includes('3 month')) {
    warrantyScore = 40; warrantyExplanation = '90-day warranty';
  } else if (warrantyText.includes('no warranty') || warrantyText.includes('as-is')) {
    warrantyScore = 10; warrantyExplanation = 'Sold as-is, no warranty';
  }

  metrics.warranty = { score: warrantyScore, explanation: warrantyExplanation };

  // ── 5. Delivery Speed ────────────────────────────────────────────────────
  const deliveryDays = supplier.avg_delivery_days || 3;
  let deliveryScore;
  let deliveryExplanation;

  if (deliveryDays <= 1) {
    deliveryScore = 100; deliveryExplanation = 'Same-day or next-day delivery';
  } else if (deliveryDays <= 2) {
    deliveryScore = 90; deliveryExplanation = `Average delivery: ${deliveryDays} days`;
  } else if (deliveryDays <= 3) {
    deliveryScore = 80; deliveryExplanation = `Average delivery: ${deliveryDays} days`;
  } else if (deliveryDays <= 5) {
    deliveryScore = 65; deliveryExplanation = `Average delivery: ${deliveryDays} days`;
  } else if (deliveryDays <= 7) {
    deliveryScore = 45; deliveryExplanation = `Slow delivery: ${deliveryDays} days`;
  } else {
    deliveryScore = 20; deliveryExplanation = `Very slow delivery: ${deliveryDays} days`;
  }

  metrics.delivery = { score: deliveryScore, explanation: deliveryExplanation };

  // ── 6. Data Freshness ────────────────────────────────────────────────────
  const updatedAt = offer.updated_at || offer.created_at || supplier.created_at;
  let freshnessScore = 50;
  let freshnessExplanation = 'Data freshness unknown';

  if (updatedAt) {
    const ageMs = Date.now() - new Date(updatedAt).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    const ageDays = ageHours / 24;

    if (ageHours < 1) {
      freshnessScore = 100;
      freshnessExplanation = `Price list updated ${Math.round(ageMs / 60000)} minutes ago`;
    } else if (ageHours < 24) {
      freshnessScore = 95;
      freshnessExplanation = `Price list updated ${Math.round(ageHours)} hours ago`;
    } else if (ageDays < 3) {
      freshnessScore = 85;
      freshnessExplanation = `Price list updated ${Math.round(ageDays)} days ago`;
    } else if (ageDays < 7) {
      freshnessScore = 70;
      freshnessExplanation = `Price list updated ${Math.round(ageDays)} days ago`;
    } else if (ageDays < 14) {
      freshnessScore = 50;
      freshnessExplanation = `Price list is ${Math.round(ageDays)} days old — consider refreshing`;
    } else {
      freshnessScore = 25;
      freshnessExplanation = `Stale data: price list is ${Math.round(ageDays)} days old`;
    }
  }

  metrics.freshness = { score: freshnessScore, explanation: freshnessExplanation };

  // ── Total Score ───────────────────────────────────────────────────────────
  const totalScore = Math.round(
    weights.w1_price * metrics.price.score +
    weights.w2_stock * metrics.stock.score +
    weights.w3_reliability * metrics.reliability.score +
    weights.w4_delivery * metrics.delivery.score +
    weights.w5_warranty * metrics.warranty.score +
    weights.w6_freshness * metrics.freshness.score
  );

  return {
    totalScore: Math.min(100, totalScore),
    metrics,
    // Legacy compatibility
    breakdown: {
      priceScore: Math.round(metrics.price.score / 100 * 100) / 100,
      stockScore: Math.round(metrics.stock.score / 100 * 100) / 100,
      reliabilityScore: Math.round(metrics.reliability.score / 100 * 100) / 100,
      deliveryScore: Math.round(metrics.delivery.score / 100 * 100) / 100,
      warrantyScore: Math.round(metrics.warranty.score / 100 * 100) / 100,
      freshnessScore: Math.round(metrics.freshness.score / 100 * 100) / 100
    }
  };
}

// Legacy compatibility wrapper
export function calculateSupplierScore(offer, allOffersForProduct, supplier) {
  const result = calculateSupplierIntelligence(offer, allOffersForProduct, supplier);
  return {
    totalScore: result.totalScore / 100,
    breakdown: result.breakdown
  };
}
