import { getStore } from './db.js';
import { productRepo, offerRepo } from './repositories/index.js';
import { calculateSupplierIntelligence } from './scoringEngine.js';

/**
 * Storefront Synchronization Service
 *
 * 4 Pricing Strategies:
 *   1. Markup:            Retail = Cost × (1 + rate)
 *   2. Gross Margin:      Retail = Cost / (1 - rate)
 *   3. Fixed Price:       Retail = fixedPrice
 *   4. Cost + Fixed:      Retail = Cost + fixedAmount
 *
 * Public feed (/api/storefront/products) NEVER exposes acquisition cost or margin data.
 * Internal feed (/api/internal/storefront-economics) shows full economics for admin dashboard.
 */

const VALID_STRATEGIES = ['markup', 'gross_margin', 'fixed_price', 'cost_plus_fixed'];

/**
 * Calculate retail price from acquisition cost using a pricing strategy.
 */
export function calculateRetailPrice(acquisitionCost, strategy = 'markup', params = {}) {
  const rate = params.rate || 0.30;
  const fixedPrice = params.fixedPrice || 0;
  const fixedAmount = params.fixedAmount || 0;

  switch (strategy) {
    case 'markup':
      // Retail = Cost × (1 + rate)
      return Math.round(acquisitionCost * (1 + rate));

    case 'gross_margin':
      // Retail = Cost / (1 - rate)
      if (rate >= 1.0) return Math.round(acquisitionCost * 3); // safety cap
      return Math.round(acquisitionCost / (1 - rate));

    case 'fixed_price':
      return Math.round(fixedPrice);

    case 'cost_plus_fixed':
      return Math.round(acquisitionCost + fixedAmount);

    default:
      return Math.round(acquisitionCost * 1.30); // fallback to 30% markup
  }
}

/**
 * Get storefront settings.
 */
export function getStorefrontSettings() {
  const store = getStore();
  return store.storefront_settings || {
    defaultPricingStrategy: 'markup',
    defaultMarginRate: 0.30,
    productOverrides: {}
  };
}

/**
 * Update storefront settings.
 */
export function updateStorefrontSettings(updates) {
  const store = getStore();
  store.storefront_settings = {
    ...store.storefront_settings,
    ...updates
  };
  return store.storefront_settings;
}

/**
 * Generate the PUBLIC storefront product feed.
 * No acquisition cost, no margin, no supplier names.
 */
export async function getPublicProductFeed() {
  const products = await productRepo.findAll({ excludeMerged: true });
  const store = getStore();
  const settings = getStorefrontSettings();
  const feed = [];

  for (const product of products) {
    const offers = await offerRepo.findByProduct(product.id);
    if (!offers.length) continue;

    // Find best offer (lowest cost_in_base_currency)
    const bestOffer = offers.reduce((best, o) => {
      const cost = o.cost_in_base_currency || 0;
      return cost > 0 && (!best || cost < best.cost_in_base_currency) ? o : best;
    }, null);

    if (!bestOffer) continue;

    // Get product-specific pricing override or use defaults
    const override = settings.productOverrides?.[product.id] || {};
    const strategy = override.strategy || settings.defaultPricingStrategy;
    const rate = override.rate !== undefined ? override.rate : settings.defaultMarginRate;

    const retailPrice = calculateRetailPrice(bestOffer.cost_in_base_currency, strategy, {
      rate,
      fixedPrice: override.fixedPrice,
      fixedAmount: override.fixedAmount
    });

    // Total available stock across all suppliers
    const totalStock = offers.reduce((sum, o) => sum + (o.quantity_available || 0), 0);

    const specs = typeof product.specifications === 'string'
      ? JSON.parse(product.specifications || '{}')
      : (product.specifications || {});

    feed.push({
      productId: product.id,
      name: product.canonical_name,
      brand: product.brand || 'Generic',
      category: product.category || 'Electronics',
      price: retailPrice,
      currency: 'KES',
      availability: totalStock > 0 ? 'in_stock' : 'out_of_stock',
      quantity: totalStock,
      specifications: specs,
      model: product.model_number || null
    });
  }

  return feed;
}

/**
 * Generate the INTERNAL storefront economics feed.
 * Shows full acquisition cost, margins, and pricing strategy — admin only.
 */
export async function getInternalEconomicsFeed() {
  const products = await productRepo.findAll({ excludeMerged: true });
  const store = getStore();
  const settings = getStorefrontSettings();
  const feed = [];

  for (const product of products) {
    const offers = await offerRepo.findByProduct(product.id);
    if (!offers.length) continue;

    const bestOffer = offers.reduce((best, o) => {
      const cost = o.cost_in_base_currency || 0;
      return cost > 0 && (!best || cost < best.cost_in_base_currency) ? o : best;
    }, null);

    if (!bestOffer) continue;

    const override = settings.productOverrides?.[product.id] || {};
    const strategy = override.strategy || settings.defaultPricingStrategy;
    const rate = override.rate !== undefined ? override.rate : settings.defaultMarginRate;

    const acquisitionCost = Math.round(bestOffer.cost_in_base_currency);
    const retailPrice = calculateRetailPrice(acquisitionCost, strategy, {
      rate,
      fixedPrice: override.fixedPrice,
      fixedAmount: override.fixedAmount
    });

    const grossMargin = retailPrice > 0 ? Math.round(((retailPrice - acquisitionCost) / retailPrice) * 10000) / 100 : 0;
    const markup = acquisitionCost > 0 ? Math.round(((retailPrice - acquisitionCost) / acquisitionCost) * 10000) / 100 : 0;

    const totalStock = offers.reduce((sum, o) => sum + (o.quantity_available || 0), 0);

    feed.push({
      productId: product.id,
      name: product.canonical_name,
      brand: product.brand,
      acquisitionCost,
      retailPrice,
      grossMargin,
      markup,
      profitPerUnit: retailPrice - acquisitionCost,
      pricingStrategy: strategy,
      pricingRate: rate,
      supplierCount: offers.length,
      bestSupplier: bestOffer.supplier?.name || 'Unknown',
      totalStock,
      availability: totalStock > 0 ? 'in_stock' : 'out_of_stock',
      currency: 'KES'
    });
  }

  return feed;
}
