import { priceObservationRepo } from './repositories/index.js';

/**
 * Price Trend Engine — Historical price analysis with confidence qualification.
 *
 * Confidence tiers:
 *   "high"         — ≥5 observations in the window
 *   "medium"       — 3-4 observations
 *   "low"          — 1-2 observations
 *   "insufficient" — 0 observations → "Insufficient historical data"
 */

/**
 * Calculate price trends for a product from a specific supplier.
 *
 * @param {string} productId - Canonical product ID
 * @param {string} supplierId - Supplier ID (optional — if omitted, uses best offer)
 * @returns {Object} Trend data with 7d and 30d analysis
 */
export async function calculatePriceTrend(productId, supplierId = null) {
  // Get observations for both time windows
  const history7d = await priceObservationRepo.getHistory(productId, supplierId, { days: 7 });
  const history30d = await priceObservationRepo.getHistory(productId, supplierId, { days: 30 });

  // Get current (latest) price
  let currentObs = null;
  if (supplierId) {
    currentObs = await priceObservationRepo.getLatest(productId, supplierId);
  } else {
    const allObs = await priceObservationRepo.getAllForProduct(productId);
    if (allObs.length > 0) {
      currentObs = allObs[allObs.length - 1];
    }
  }

  const currentPrice = currentObs ? currentObs.price_in_base_currency : null;

  return {
    productId,
    supplierId,
    currentPrice,
    currency: 'KES',
    trend7d: calculateWindowTrend(history7d, currentPrice, 7),
    trend30d: calculateWindowTrend(history30d, currentPrice, 30),
    alert: generateAlert(history7d, history30d, currentPrice),
    sparklineData: generateSparkline(history30d)
  };
}

/**
 * Get price trends for all suppliers of a product.
 */
export async function getProductTrends(productId) {
  const allObservations = await priceObservationRepo.getAllForProduct(productId);

  // Group by supplier
  const supplierIds = [...new Set(allObservations.map((o) => o.supplier_id))];

  const trends = [];
  for (const supplierId of supplierIds) {
    const trend = await calculatePriceTrend(productId, supplierId);
    trends.push(trend);
  }

  return trends;
}

// ─── Internal Functions ─────────────────────────────────────────────────────

function calculateWindowTrend(observations, currentPrice, days) {
  const count = observations.length;
  const confidence = getConfidence(count);

  if (count === 0 || !currentPrice) {
    return {
      change: null,
      direction: null,
      previousPrice: null,
      currentPrice,
      observationCount: count,
      confidence,
      windowDays: days,
      message: 'Insufficient historical data'
    };
  }

  // Use the earliest observation in the window as the baseline
  const earliest = observations[0];
  const previousPrice = earliest.price_in_base_currency;

  if (!previousPrice || previousPrice === 0) {
    return {
      change: null,
      direction: null,
      previousPrice: null,
      currentPrice,
      observationCount: count,
      confidence,
      windowDays: days,
      message: 'No valid baseline price'
    };
  }

  const changePercent = Math.round(((currentPrice - previousPrice) / previousPrice) * 10000) / 100;
  const direction = changePercent > 0.5 ? 'up' : changePercent < -0.5 ? 'down' : 'stable';

  let message;
  if (confidence === 'insufficient') {
    message = 'Insufficient historical data';
  } else if (direction === 'stable') {
    message = `Price stable over ${days} days (${count} observations)`;
  } else {
    const verb = direction === 'down' ? 'dropped' : 'increased';
    message = `Price ${verb} ${Math.abs(changePercent)}% over ${days} days`;
    if (confidence !== 'high') {
      message += ` (based on ${count} observation${count > 1 ? 's' : ''})`;
    }
  }

  return {
    change: changePercent,
    direction,
    previousPrice: Math.round(previousPrice),
    currentPrice: Math.round(currentPrice),
    observationCount: count,
    confidence,
    windowDays: days,
    message
  };
}

function getConfidence(observationCount) {
  if (observationCount >= 5) return 'high';
  if (observationCount >= 3) return 'medium';
  if (observationCount >= 1) return 'low';
  return 'insufficient';
}

function generateAlert(history7d, history30d, currentPrice) {
  if (!currentPrice) return null;

  // Prioritize 7-day trend for alerts
  if (history7d.length >= 2) {
    const earliest7d = history7d[0].price_in_base_currency;
    const change7d = ((currentPrice - earliest7d) / earliest7d) * 100;

    if (change7d <= -5) {
      return {
        type: 'price_drop',
        icon: '🟢',
        message: `Price dropped ${Math.abs(Math.round(change7d * 10) / 10)}% this week`,
        severity: 'positive',
        confidence: getConfidence(history7d.length),
        detail: `Based on ${history7d.length} observations over 7 days`
      };
    }
    if (change7d >= 5) {
      return {
        type: 'price_increase',
        icon: '🔴',
        message: `Price increased ${Math.round(change7d * 10) / 10}% this week`,
        severity: 'warning',
        confidence: getConfidence(history7d.length),
        detail: `Based on ${history7d.length} observations over 7 days`
      };
    }
  }

  // Fall back to 30-day trend
  if (history30d.length >= 3) {
    const earliest30d = history30d[0].price_in_base_currency;
    const change30d = ((currentPrice - earliest30d) / earliest30d) * 100;

    if (change30d <= -3) {
      return {
        type: 'price_drop',
        icon: '🟢',
        message: `Price dropped ${Math.abs(Math.round(change30d * 10) / 10)}% over 30 days`,
        severity: 'positive',
        confidence: getConfidence(history30d.length),
        detail: `Based on ${history30d.length} observations over 30 days`
      };
    }
    if (change30d >= 8) {
      return {
        type: 'price_increase',
        icon: '🔴',
        message: `Price increased ${Math.round(change30d * 10) / 10}% over 30 days`,
        severity: 'warning',
        confidence: getConfidence(history30d.length),
        detail: `Based on ${history30d.length} observations over 30 days`
      };
    }
  }

  return {
    type: 'stable',
    icon: '⚪',
    message: 'Price stable',
    severity: 'neutral',
    confidence: getConfidence(history7d.length + history30d.length),
    detail: `${history30d.length} observations over 30 days`
  };
}

function generateSparkline(observations) {
  return observations.map((o) => ({
    date: o.captured_at,
    price: Math.round(o.price_in_base_currency),
    supplierId: o.supplier_id
  }));
}
