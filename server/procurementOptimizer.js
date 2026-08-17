import { offerRepo } from './repositories/index.js';
import { calculateSupplierIntelligence, getScoringWeights } from './scoringEngine.js';
import { getStore } from './db.js';

/**
 * Multi-Supplier Procurement Optimizer
 *
 * Two optimization modes:
 *   1. Lowest Cost — minimize total acquisition cost, constrained by stock
 *   2. Best Value  — minimize composite objective including risk & delivery penalties
 *
 * Constraints:
 *   sum(quantity_i) >= requested_quantity
 *   0 <= quantity_i <= supplier_stock_i
 *   quantity_i must be integer
 */

/**
 * Run the procurement optimizer for a canonical product.
 *
 * @param {string} canonicalProductId
 * @param {number} requestedQuantity
 * @param {string} mode - 'lowest_cost' | 'best_value'
 * @returns {Object} Optimization result with allocations, cost, savings, reasoning
 */
export async function optimizeProcurement(canonicalProductId, requestedQuantity, mode = 'best_value') {
  const store = getStore();

  // Get all active offers for this product
  const offers = await offerRepo.findByProduct(canonicalProductId);

  if (!offers.length) {
    return {
      success: false,
      error: 'No supplier offers available for this product',
      allocations: [],
      totalCost: 0,
      reasoning: ['No suppliers have listed this product']
    };
  }

  // Calculate intelligence scores for each offer
  const scoredOffers = offers.map((offer) => {
    const supplier = offer.supplier || store.suppliers.find((s) => s.id === offer.supplier_id) || {};
    const intelligence = calculateSupplierIntelligence(offer, offers, supplier);
    return {
      ...offer,
      supplier,
      intelligence,
      effectiveStock: Math.max(0, offer.quantity_available || 0),
      unitCostKES: offer.cost_in_base_currency || 0
    };
  }).filter((o) => o.unitCostKES > 0); // Exclude offers with no price

  // Check total available stock
  const totalAvailable = scoredOffers.reduce((sum, o) => sum + o.effectiveStock, 0);

  if (totalAvailable < requestedQuantity) {
    return {
      success: false,
      error: `Insufficient total stock. Requested: ${requestedQuantity}, Available: ${totalAvailable}`,
      allocations: scoredOffers.map((o) => ({
        supplier: { id: o.supplier_id, name: o.supplier.name },
        availableStock: o.effectiveStock,
        unitCost: o.unitCostKES,
        score: o.intelligence.totalScore
      })),
      totalCost: 0,
      reasoning: [
        `Total available stock across all suppliers: ${totalAvailable}`,
        `Requested quantity: ${requestedQuantity}`,
        `Shortfall: ${requestedQuantity - totalAvailable} units`
      ]
    };
  }

  let allocations;
  if (mode === 'lowest_cost') {
    allocations = solveLowestCost(scoredOffers, requestedQuantity);
  } else {
    allocations = solveBestValue(scoredOffers, requestedQuantity);
  }

  // Calculate total cost
  const totalCost = allocations.reduce((sum, a) => sum + a.subtotal, 0);

  // Calculate alternative: single best supplier (if one can fulfill)
  const singleSupplierAlts = scoredOffers
    .filter((o) => o.effectiveStock >= requestedQuantity)
    .map((o) => ({
      supplier: o.supplier.name || o.supplier_id,
      unitCost: o.unitCostKES,
      totalCost: o.unitCostKES * requestedQuantity,
      score: o.intelligence.totalScore
    }))
    .sort((a, b) => a.totalCost - b.totalCost);

  const cheapestSingle = singleSupplierAlts[0] || null;

  // Calculate savings
  let saving = 0;
  let savingPercent = 0;
  let alternativeDescription = null;

  if (cheapestSingle) {
    saving = Math.round(cheapestSingle.totalCost - totalCost);
    savingPercent = cheapestSingle.totalCost > 0
      ? Math.round((saving / cheapestSingle.totalCost) * 10000) / 100
      : 0;
    alternativeDescription = `Buy all ${requestedQuantity} from ${cheapestSingle.supplier}`;
  }

  // Generate reasoning
  const reasoning = generateReasoning(allocations, scoredOffers, requestedQuantity, mode, cheapestSingle, saving);

  // Calculate confidence (weighted average of allocated supplier scores)
  const totalAllocated = allocations.reduce((sum, a) => sum + a.quantity, 0);
  const confidence = totalAllocated > 0
    ? Math.round(allocations.reduce((sum, a) => sum + (a.score * a.quantity), 0) / totalAllocated)
    : 0;

  return {
    success: true,
    mode,
    requestedQuantity,
    allocations: allocations.map((a) => ({
      supplier: { id: a.supplierId, name: a.supplierName },
      quantity: a.quantity,
      unitCost: Math.round(a.unitCost),
      subtotal: Math.round(a.subtotal),
      score: a.score,
      currency: 'KES'
    })),
    totalCost: Math.round(totalCost),
    alternative: cheapestSingle ? {
      description: alternativeDescription,
      totalCost: Math.round(cheapestSingle.totalCost),
      supplier: cheapestSingle.supplier,
      score: cheapestSingle.score
    } : null,
    saving: Math.round(Math.abs(saving)),
    savingPercent: Math.abs(savingPercent),
    savingDirection: saving > 0 ? 'cheaper' : saving < 0 ? 'more_expensive' : 'same',
    confidence,
    reasoning,
    currency: 'KES'
  };
}

// ─── Lowest Cost Solver ─────────────────────────────────────────────────────

function solveLowestCost(scoredOffers, requestedQty) {
  // Sort by unit cost ascending — pure price optimization
  const sorted = [...scoredOffers].sort((a, b) => a.unitCostKES - b.unitCostKES);

  const allocations = [];
  let remaining = requestedQty;

  for (const offer of sorted) {
    if (remaining <= 0) break;
    const allocQty = Math.min(remaining, offer.effectiveStock);
    if (allocQty > 0) {
      allocations.push({
        supplierId: offer.supplier_id,
        supplierName: offer.supplier.name || offer.supplier_id,
        quantity: allocQty,
        unitCost: offer.unitCostKES,
        subtotal: allocQty * offer.unitCostKES,
        score: offer.intelligence.totalScore,
        effectiveStock: offer.effectiveStock
      });
      remaining -= allocQty;
    }
  }

  return allocations;
}

// ─── Best Value Solver ──────────────────────────────────────────────────────

function solveBestValue(scoredOffers, requestedQty) {
  /**
   * Composite objective per unit from supplier i:
   *   cost_i = unitPrice_i + riskPenalty_i + deliveryPenalty_i - reliabilityBenefit_i
   *
   * Where:
   *   riskPenalty     = (100 - supplierScore) * penaltyFactor
   *   deliveryPenalty = deliveryDays * deliveryPenaltyFactor
   *   reliabilityBenefit = (reliabilityScore / 10) * benefitFactor
   */
  const RISK_PENALTY_FACTOR = 50;        // KES penalty per score point below 100
  const DELIVERY_PENALTY_FACTOR = 200;   // KES penalty per delivery day
  const RELIABILITY_BENEFIT_FACTOR = 100; // KES benefit per reliability point

  const valued = scoredOffers.map((offer) => {
    const supplierScore = offer.intelligence.totalScore;
    const deliveryDays = offer.supplier.avg_delivery_days || 3;
    const reliability = offer.supplier.reliability_score || 8.0;

    const riskPenalty = (100 - supplierScore) * RISK_PENALTY_FACTOR;
    const deliveryPenalty = deliveryDays * DELIVERY_PENALTY_FACTOR;
    const reliabilityBenefit = (reliability / 10) * RELIABILITY_BENEFIT_FACTOR;

    const effectiveCost = offer.unitCostKES + riskPenalty + deliveryPenalty - reliabilityBenefit;

    return { ...offer, effectiveCost };
  });

  // Sort by effective cost (composite value)
  valued.sort((a, b) => a.effectiveCost - b.effectiveCost);

  const allocations = [];
  let remaining = requestedQty;

  for (const offer of valued) {
    if (remaining <= 0) break;
    const allocQty = Math.min(remaining, offer.effectiveStock);
    if (allocQty > 0) {
      allocations.push({
        supplierId: offer.supplier_id,
        supplierName: offer.supplier.name || offer.supplier_id,
        quantity: allocQty,
        unitCost: offer.unitCostKES,
        subtotal: allocQty * offer.unitCostKES,
        score: offer.intelligence.totalScore,
        effectiveStock: offer.effectiveStock
      });
      remaining -= allocQty;
    }
  }

  return allocations;
}

// ─── Reasoning Generator ────────────────────────────────────────────────────

function generateReasoning(allocations, scoredOffers, requestedQty, mode, cheapestSingle, saving) {
  const reasons = [];

  if (mode === 'lowest_cost') {
    reasons.push('Optimization mode: Lowest Cost — minimizing total acquisition cost');
  } else {
    reasons.push('Optimization mode: Best Value — balancing cost, reliability, delivery, and supplier score');
  }

  if (allocations.length > 1) {
    reasons.push(`Order split across ${allocations.length} suppliers:`);
    for (const alloc of allocations) {
      const stockNote = alloc.effectiveStock < requestedQty
        ? ` (only ${alloc.effectiveStock} units available)`
        : '';
      reasons.push(`  • ${alloc.supplierName}: ${alloc.quantity} units @ KSh ${Math.round(alloc.unitCost).toLocaleString()}/unit${stockNote}`);
    }

    // Explain why it was split
    const primaryAlloc = allocations[0];
    if (primaryAlloc.effectiveStock < requestedQty) {
      reasons.push(`${primaryAlloc.supplierName} only has ${primaryAlloc.effectiveStock} units available`);
      if (allocations.length > 1) {
        const secondary = allocations[1];
        reasons.push(`Remaining ${secondary.quantity} units sourced from ${secondary.supplierName}`);
      }
    }
  } else if (allocations.length === 1) {
    const alloc = allocations[0];
    reasons.push(`Single supplier can fulfill: ${alloc.supplierName}`);
    reasons.push(`  • ${alloc.quantity} units @ KSh ${Math.round(alloc.unitCost).toLocaleString()}/unit`);
  }

  // Savings context
  if (cheapestSingle && saving > 0) {
    reasons.push(`Saves KSh ${Math.round(saving).toLocaleString()} vs buying all from ${cheapestSingle.supplier}`);
  } else if (cheapestSingle && saving < 0) {
    reasons.push(`Costs KSh ${Math.round(Math.abs(saving)).toLocaleString()} more than cheapest single supplier (${cheapestSingle.supplier}), but offers better value through reliability and delivery`);
  }

  // Supplier score context
  for (const alloc of allocations) {
    const scored = scoredOffers.find((o) => o.supplier_id === alloc.supplierId);
    if (scored) {
      const intel = scored.intelligence;
      const highlights = [];
      if (intel.metrics.price.score >= 90) highlights.push(`${intel.metrics.price.score}/100 price competitiveness`);
      if (intel.metrics.reliability.score >= 90) highlights.push(`${intel.metrics.reliability.explanation}`);
      if (intel.metrics.stock.score >= 80) highlights.push(`${intel.metrics.stock.explanation}`);
      if (intel.metrics.freshness.score >= 90) highlights.push(`${intel.metrics.freshness.explanation}`);
      if (highlights.length > 0) {
        reasons.push(`${alloc.supplierName}: ${highlights.join(', ')}`);
      }
    }
  }

  return reasons;
}
