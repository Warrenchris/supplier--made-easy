let scoringWeights = {
  w1_price: 0.40,
  w2_stock: 0.25,
  w3_reliability: 0.20,
  w4_delivery: 0.10,
  w5_warranty: 0.05
};

export function getScoringWeights() {
  return { ...scoringWeights };
}

export function updateScoringWeights(newWeights) {
  scoringWeights = { ...scoringWeights, ...newWeights };
  return { ...scoringWeights };
}

export function calculateSupplierScore(offer, allOffersForProduct, supplier) {
  const weights = getScoringWeights();

  // 1. Price score (lower price relative to min price = higher score)
  const prices = allOffersForProduct.map((o) => o.price_in_base_currency).filter((p) => p > 0);
  const minPrice = prices.length ? Math.min(...prices) : offer.price_in_base_currency;
  const maxPrice = prices.length ? Math.max(...prices) : offer.price_in_base_currency;

  let priceScore = 1.0;
  if (maxPrice > minPrice) {
    priceScore = 1.0 - ((offer.price_in_base_currency - minPrice) / (maxPrice - minPrice)) * 0.5;
  }
  priceScore = Math.max(0, Math.min(1.0, priceScore));

  // 2. Stock score
  let stockScore = 0.2;
  if (offer.stock_status === 'in_stock') {
    stockScore = offer.stock_qty > 10 ? 1.0 : offer.stock_qty > 0 ? 0.8 : 0.7;
  } else if (offer.stock_status === 'backorder') {
    stockScore = 0.4;
  }

  // 3. Reliability score (0-10 normalized to 0-1)
  const reliabilityScore = Math.max(0, Math.min(1.0, (supplier.reliability_score || 8.0) / 10.0));

  // 4. Delivery speed score (lower delivery days = higher score)
  const deliveryDays = supplier.avg_delivery_days || 3;
  const deliveryScore = Math.max(0.2, Math.min(1.0, 1.0 - (deliveryDays / 14)));

  // 5. Warranty score
  const warrantyText = String(supplier.warranty_terms_default || "").toLowerCase();
  let warrantyScore = 0.5;
  if (warrantyText.includes("2 year") || warrantyText.includes("3 year")) warrantyScore = 1.0;
  else if (warrantyText.includes("1 year")) warrantyScore = 0.8;
  else if (warrantyText.includes("6 month")) warrantyScore = 0.6;

  const totalScore = (
    weights.w1_price * priceScore +
    weights.w2_stock * stockScore +
    weights.w3_reliability * reliabilityScore +
    weights.w4_delivery * deliveryScore +
    weights.w5_warranty * warrantyScore
  );

  return {
    totalScore: Math.round(totalScore * 100) / 100,
    breakdown: {
      priceScore: Math.round(priceScore * 100) / 100,
      stockScore: Math.round(stockScore * 100) / 100,
      reliabilityScore: Math.round(reliabilityScore * 100) / 100,
      deliveryScore: Math.round(deliveryScore * 100) / 100,
      warrantyScore: Math.round(warrantyScore * 100) / 100,
    }
  };
}
