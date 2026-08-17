import { productRepo, offerRepo, priceObservationRepo } from './repositories/index.js';
import { query, get, run } from './db.js';
import { convertToBaseCurrency, getExchangeRates } from './fxService.js';

/**
 * Product Identity Engine (v3.1 Adversarial-Hardened)
 * 
 * Pipeline: Supplier Listing → Normalize → Extract Brand → Extract Model
 *           → Extract SKU/MPN → Extract Specifications → Find Canonical Product
 *           → Confidence Score
 */

const KNOWN_BRANDS = [
  "SAMSUNG", "DELL", "APPLE", "LOGITECH", "HP", "LENOVO", "CISCO", "SEAGATE",
  "WESTERN DIGITAL", "WD", "KINGSTON", "CRUCIAL", "SANDISK", "ASUS", "ACER",
  "TP-LINK", "MIKROTIK", "UBIQUITI", "EPSON", "CANON", "BROTHER", "SONY",
  "MICROSOFT", "LG", "INTEL", "AMD", "NVIDIA", "CORSAIR", "RAZER", "HUAWEI",
  "XIAOMI", "TOSHIBA", "HISENSE", "TCL", "BENQ", "VIEWSONIC", "MSI", "GIGABYTE"
];

const MODEL_PATTERNS = [
  // 990 Series (Specific to General)
  /\b(990\s*EVO\s*(?:\+|PLUS))\b/i,
  /\b(990\s*PRO\s*(?:PLUS|\+)?)\b/i,
  /\b(990\s*EVO)\b/i,
  // 980 Series
  /\b(980\s*PRO)\b/i,
  /\b(980\s*EVO)\b/i,
  /\b(980)\b/i,
  // 970 Series
  /\b(970\s*EVO\s*(?:\+|PLUS))\b/i,
  /\b(970\s*EVO)\b/i,
  /\b(970\s*PRO)\b/i,
  // 870 Series
  /\b(870\s*EVO)\b/i,
  /\b(870\s*QVO)\b/i,
  // Laptops & Peripherals
  /\b(XPS\s*\d{2,4})\b/i,
  /\b(LATITUDE\s*\d{3,4})\b/i,
  /\b(INSPIRON\s*\d{3,4})\b/i,
  /\b(MACBOOK\s*(?:PRO|AIR)\s*\d+)\b/i,
  /\b(M[1234]\s*(?:PRO|MAX|ULTRA)?)\b/i,
  /\b(MX\s*MASTER\s*3S?)\b/i,
  /\b(MX\s*KEYS\s*(?:S|MINI)?)\b/i,
  /\b(THINKPAD\s*[A-Z]\d{2,3})\b/i,
  /\b(ELITEBOOK\s*\d{3,4})\b/i,
  /\b(GALAXY\s*[AS]\d{1,2})\b/i,
  /\b(IPHONE\s*\d{1,2}\s*(?:PRO|PLUS|MAX)?)\b/i,
  /\b(IPAD\s*(?:PRO|AIR|MINI)?)\b/i,
  /\b(SURFACE\s*(?:PRO|LAPTOP|GO)\s*\d*)\b/i,
  /\b(T\d{3,4}[A-Z]*)\b/i,
  /\b(VIEWFINITY\s*[A-Z]*\d*)\b/i,
];

const CATEGORY_KEYWORDS = {
  'SSD': ['ssd', 'solid state', 'nvme', 'm.2', 'sata drive', 'pcie 4.0', 'pcie 5.0'],
  'HDD': ['hdd', 'hard drive', 'hard disk'],
  'Laptop': ['laptop', 'notebook', 'ultrabook', 'macbook', 'thinkpad', 'xps', 'latitude', 'elitebook', 'inspiron'],
  'Mouse': ['mouse', 'mice', 'trackpad', 'mx master', 'mx keys'],
  'Keyboard': ['keyboard', 'keycaps', 'mechanical keyboard'],
  'Monitor': ['monitor', 'display', 'screen', 'viewfinity'],
  'RAM': ['ram', 'ddr4', 'ddr5', 'memory module', 'dimm', 'sodimm'],
  'Printer': ['printer', 'scanner', 'multifunction', 'laser printer', 'inkjet'],
  'Router': ['router', 'access point', 'switch', 'firewall', 'mikrotik', 'ubiquiti'],
  'Phone': ['phone', 'smartphone', 'iphone', 'galaxy', 'pixel'],
  'Tablet': ['tablet', 'ipad', 'surface'],
  'GPU': ['gpu', 'graphics card', 'geforce', 'radeon', 'rtx', 'gtx'],
  'CPU': ['cpu', 'processor', 'core i', 'ryzen', 'xeon'],
  'Cable': ['cable', 'adapter', 'dongle', 'hub', 'dock'],
  'Power': ['ups', 'power supply', 'psu', 'battery', 'charger'],
};

// ─── Normalization Functions ────────────────────────────────────────────────

export function normalizeName(name) {
  if (!name) return "";
  return String(name).trim().toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSku(sku) {
  if (!sku) return "";
  return String(sku).trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// ─── Extraction Functions ───────────────────────────────────────────────────

export function extractBrand(text) {
  const upper = String(text || '').toUpperCase();
  const brand = KNOWN_BRANDS.find((b) => upper.includes(b));
  if (brand) return brand === "WD" ? "WESTERN DIGITAL" : brand;

  const firstWord = upper.split(/[\s-]+/)[0];
  if (firstWord && firstWord.length >= 2 && KNOWN_BRANDS.includes(firstWord)) {
    return firstWord;
  }
  return null;
}

export function extractModel(text) {
  const upper = String(text || '').toUpperCase().replace(/\+/g, ' PLUS ');
  for (const pattern of MODEL_PATTERNS) {
    const match = upper.match(pattern);
    if (match) {
      return match[1].replace(/\s+/g, ' ').trim().replace(/\+$/, 'PLUS').trim();
    }
  }
  return null;
}

export function extractCategory(text) {
  const lower = String(text || '').toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return category;
    }
  }
  return 'Electronics';
}

export function extractSpecifications(text) {
  const upper = String(text || '').toUpperCase();
  const specs = {};

  // Capacity (storage/RAM)
  const capMatch = upper.match(/\b(\d+)\s*(TB|GB|MB)\b/);
  if (capMatch) {
    specs.capacity = `${capMatch[1]}${capMatch[2]}`;
  }

  // Interface
  const intMatch = upper.match(/\b(NVME|SATA|M\.2|PCIE\s*(?:4\.0|5\.0|GEN\s*[45])?|GEN\s*[45]|USB-C|THUNDERBOLT|HDMI|DISPLAYPORT|USB\s*3\.\d)\b/);
  if (intMatch) {
    specs.interface = intMatch[1].trim();
  }

  // Form factor
  const ffMatch = upper.match(/\b(M\.2|2\.5\s*(?:INCH|")?|3\.5\s*(?:INCH|")?|MINI-ITX|ATX|MICRO-ATX)\b/);
  if (ffMatch) {
    specs.formFactor = ffMatch[1].trim();
  }

  // Color
  const colorMatch = upper.match(/\b(BLACK|WHITE|SILVER|GRAY|GREY|GRAPHITE|SPACE\s*GRAY|MIDNIGHT|STARLIGHT|GOLD|BLUE|RED|GREEN|PINK)\b/);
  if (colorMatch) {
    specs.color = colorMatch[1].replace(/\s+/g, ' ').trim();
  }

  // Processor
  const procMatch = upper.match(/\b(CORE\s*I[3579]|RYZEN\s*[3579]|M[1234]\s*(?:PRO|MAX)?)\b/);
  if (procMatch) {
    specs.processor = procMatch[1].trim();
  }

  return specs;
}

export function extractIdentifiers(rawSku, rawName) {
  const identifiers = {};

  if (rawSku) {
    identifiers.supplierSku = rawSku;
    identifiers.mpn = normalizeSku(rawSku);
  }

  // Try to extract MPN patterns (e.g. MZ-V9S1T0BW, MRX33LL/A, MZV9S1T0BW)
  const mpnMatch = String(rawName || '').match(/\b([A-Z]{2,3}[-]?[A-Z0-9]{3,}[A-Z0-9/]*)\b/i);
  if (mpnMatch && mpnMatch[1].length >= 6) {
    identifiers.detectedMpn = mpnMatch[1].toUpperCase();
    if (!identifiers.mpn) {
      identifiers.mpn = normalizeSku(mpnMatch[1]);
    }
  }

  return identifiers;
}

// ─── Main Pipeline ──────────────────────────────────────────────────────────

export function normalizeListing(rawListing) {
  const rawName = rawListing.raw_name || rawListing.name || '';
  const rawSku = rawListing.raw_sku || rawListing.sku || '';

  return {
    normalizedName: normalizeName(rawName),
    brand: extractBrand(rawName) || extractBrand(rawSku),
    model: extractModel(rawName) || extractModel(rawSku),
    category: extractCategory(rawName),
    specifications: extractSpecifications(rawName),
    identifiers: extractIdentifiers(rawSku, rawName)
  };
}

/**
 * Calculate similarity between a normalized listing and a canonical product.
 * Adversarially hardened against false positives for different models.
 */
export function calculateSimilarity(normalized, canonical) {
  let score = 0;
  const signals = [];
  const maxScore = 5;

  const cBrand = (canonical.brand || '').toUpperCase();
  const cModel = (canonical.model_number || '').toUpperCase();
  const cSpecs = typeof canonical.specifications === 'string'
    ? JSON.parse(canonical.specifications || '{}')
    : (canonical.specifications || {});
  const cAttrs = typeof canonical.attributes === 'string'
    ? JSON.parse(canonical.attributes || '{}')
    : (canonical.attributes || {});
  const cIds = typeof canonical.identifiers === 'string'
    ? JSON.parse(canonical.identifiers || '{}')
    : (canonical.identifiers || {});

  // 1. Brand match (1.0 point)
  if (normalized.brand && cBrand && normalized.brand.toUpperCase() === cBrand) {
    score += 1.0;
    signals.push(`Brand match: ${normalized.brand}`);
  } else if (normalized.brand && cBrand && normalized.brand.toUpperCase() !== cBrand) {
    // Conflicting brand penalty
    return { confidence: 0.0, signals: [`Conflicting brands: ${normalized.brand} vs ${cBrand}`], explanation: 'Conflicting brands' };
  }

  // 2. Model match (1.5 points) — STRICT distinction between EVO, EVO PLUS, PRO, etc.
  if (normalized.model && cModel) {
    const normModel = normalized.model.toUpperCase().replace(/\s+/g, '');
    const canModel = cModel.replace(/\s+/g, '');

    if (normModel === canModel) {
      score += 1.5;
      signals.push(`Exact model match: ${normalized.model}`);
    } else {
      // Check if one has PLUS/PRO/MAX/ULTRA and the other doesn't
      const hasModifierNorm = /\b(PLUS|PRO|MAX|ULTRA|MINI|TI|SUPER)\b/i.test(normalized.model);
      const hasModifierCan = /\b(PLUS|PRO|MAX|ULTRA|MINI|TI|SUPER)\b/i.test(cModel);

      if (hasModifierNorm !== hasModifierCan) {
        // One is e.g. EVO and other is EVO PLUS -> STRICT REJECTION
        return {
          confidence: 0.20,
          signals: [`Model variant conflict: ${normalized.model} vs ${cModel}`],
          explanation: `Different model variants (${normalized.model} vs ${cModel})`
        };
      } else if (normModel.includes(canModel) || canModel.includes(normModel)) {
        score += 0.75;
        signals.push(`Partial model match: ${normalized.model} ≈ ${cModel}`);
      }
    }
  }

  // 3. SKU/MPN match (1.5 points)
  const normMpn = normalized.identifiers.mpn || normalized.identifiers.detectedMpn;
  const canMpn = cIds.mpn || cIds.detectedMpn;

  if (normMpn && canMpn) {
    if (normMpn === canMpn) {
      score += 1.5;
      signals.push(`MPN exact match: ${normMpn}`);
    } else if (normMpn.includes(canMpn) || canMpn.includes(normMpn)) {
      score += 1.0;
      signals.push(`MPN partial overlap: ${normMpn} ≈ ${canMpn}`);
    }
  }

  // 4. Capacity match (0.5 points)
  const normCap = (normalized.specifications.capacity || '').toUpperCase();
  const canCap = (cSpecs.capacity || cAttrs.capacity || '').toUpperCase();
  if (normCap && canCap) {
    if (normCap === canCap) {
      score += 0.5;
      signals.push(`Capacity match: ${normCap}`);
    } else {
      // Conflicting capacity -> heavily penalize
      return {
        confidence: 0.15,
        signals: [`Capacity mismatch: ${normCap} vs ${canCap}`],
        explanation: `Different capacities (${normCap} vs ${canCap})`
      };
    }
  }

  // 5. Category match (0.5 points)
  if (normalized.category && canonical.category && normalized.category === canonical.category) {
    score += 0.5;
    signals.push(`Category match: ${normalized.category}`);
  }

  const confidence = Math.min(1.0, Math.round((score / maxScore) * 100) / 100);

  const explanation = signals.length > 0
    ? `Matched: ${signals.join(' · ')}`
    : `Low similarity — no shared identity signals`;

  return {
    confidence,
    signals,
    explanation,
    brandMatch: normalized.brand && cBrand && normalized.brand.toUpperCase() === cBrand,
    modelMatch: !!signals.find((s) => s.includes('model match')),
    skuMatch: !!signals.find((s) => s.includes('MPN'))
  };
}

export async function resolveCanonicalProduct(normalized) {
  const allProducts = await productRepo.findAll({ excludeMerged: true });

  let bestMatch = null;
  let bestScore = 0;

  for (const product of allProducts) {
    const result = calculateSimilarity(normalized, product);
    if (result.confidence > bestScore) {
      bestScore = result.confidence;
      bestMatch = { product, ...result };
    }
  }

  const AUTO_CONFIRM_THRESHOLD = 0.80;
  const REVIEW_THRESHOLD = 0.40;

  if (bestMatch && bestMatch.confidence >= AUTO_CONFIRM_THRESHOLD) {
    return {
      canonicalProduct: bestMatch.product,
      confidence: bestMatch.confidence,
      matchSignals: bestMatch.signals,
      explanation: bestMatch.explanation,
      action: 'auto_confirm'
    };
  }

  if (bestMatch && bestMatch.confidence >= REVIEW_THRESHOLD) {
    return {
      canonicalProduct: bestMatch.product,
      confidence: bestMatch.confidence,
      matchSignals: bestMatch.signals,
      explanation: bestMatch.explanation,
      action: 'review_queue'
    };
  }

  return {
    canonicalProduct: null,
    confidence: bestScore,
    matchSignals: bestMatch ? bestMatch.signals : [],
    explanation: bestMatch ? bestMatch.explanation : 'No matching product found',
    action: 'create_new'
  };
}

export async function processListing(rawListingId) {
  const listing = await get(`SELECT * FROM raw_listings WHERE id = ?`, [rawListingId]);
  if (!listing) return;

  const normalized = normalizeListing(listing);
  const resolution = await resolveCanonicalProduct(normalized);

  const rates = await getExchangeRates();
  const rate = rates[listing.parsed_currency] || rates['USD'] || 129.50;
  const priceInBase = listing.parsed_price * rate;

  const stockQty = parseStockQty(listing.raw_stock_text);
  const supplier = await get(`SELECT * FROM suppliers WHERE id = ?`, [listing.supplier_id]);

  if (resolution.action === 'auto_confirm') {
    await run(
      `UPDATE raw_listings SET canonical_product_id = ?, match_confidence = ?, match_status = 'confirmed' WHERE id = ?`,
      [resolution.canonicalProduct.id, resolution.confidence, listing.id]
    );

    await offerRepo.upsert({
      canonical_product_id: resolution.canonicalProduct.id,
      supplier_id: listing.supplier_id,
      raw_listing_id: listing.id,
      supplier_sku: listing.raw_sku,
      supplier_name: listing.raw_name,
      cost: listing.parsed_price,
      currency: listing.parsed_currency,
      cost_in_base_currency: priceInBase,
      quantity_available: stockQty,
      stock_status: listing.parsed_stock_status,
      warranty_terms: supplier?.warranty_terms_default || '',
      source_import_id: listing.supplier_import_id
    });

    await priceObservationRepo.record({
      supplier_id: listing.supplier_id,
      canonical_product_id: resolution.canonicalProduct.id,
      price: listing.parsed_price,
      currency: listing.parsed_currency,
      price_in_base_currency: priceInBase,
      stock_quantity: stockQty,
      stock_status: listing.parsed_stock_status,
      source_import_id: listing.supplier_import_id,
      source: 'excel_import'
    });

    await run(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, before, after)
       VALUES (?, 'sys_auto', 'AUTO_CONFIRM_MATCH', 'raw_listing', ?, '{}', ?)`,
      [
        `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        listing.id,
        JSON.stringify({
          canonical_product_id: resolution.canonicalProduct.id,
          confidence: resolution.confidence,
          signals: resolution.matchSignals
        })
      ]
    );

  } else if (resolution.action === 'review_queue') {
    const sugId = `sug_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const existingListings = await query(
      `SELECT * FROM raw_listings WHERE r.canonical_product_id = ?`,
      [resolution.canonicalProduct.id]
    );
    const otherListing = existingListings.length > 0 ? existingListings[0] : null;

    await run(
      `INSERT INTO match_suggestions (id, raw_listing_a_id, raw_listing_b_id, canonical_product_id, similarity_score, matching_signals, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [
        sugId,
        listing.id,
        otherListing?.id || null,
        resolution.canonicalProduct.id,
        resolution.confidence,
        JSON.stringify({
          brand_match: resolution.matchSignals.some((s) => s.startsWith('Brand')),
          brand: normalized.brand,
          model_series: normalized.model,
          capacity: normalized.specifications.capacity || null,
          interface: normalized.specifications.interface || null,
          signals: resolution.matchSignals,
          explanation: resolution.explanation
        })
      ]
    );

    await run(
      `UPDATE raw_listings SET match_confidence = ?, match_status = 'suggested' WHERE id = ?`,
      [resolution.confidence, listing.id]
    );

  } else {
    const newProduct = await productRepo.create({
      canonical_name: listing.raw_name,
      brand: normalized.brand || 'Generic',
      category: normalized.category,
      model_number: normalized.model || listing.raw_sku || '',
      normalized_name: normalized.normalizedName,
      specifications: normalized.specifications,
      identifiers: normalized.identifiers,
      attributes: { ...normalized.specifications, brand: normalized.brand, model_series: normalized.model },
      match_confidence: 1.0
    });

    await run(
      `UPDATE raw_listings SET canonical_product_id = ?, match_confidence = 1.0, match_status = 'confirmed' WHERE id = ?`,
      [newProduct.id, listing.id]
    );

    await offerRepo.upsert({
      canonical_product_id: newProduct.id,
      supplier_id: listing.supplier_id,
      raw_listing_id: listing.id,
      supplier_sku: listing.raw_sku,
      supplier_name: listing.raw_name,
      cost: listing.parsed_price,
      currency: listing.parsed_currency,
      cost_in_base_currency: priceInBase,
      quantity_available: stockQty,
      stock_status: listing.parsed_stock_status,
      warranty_terms: supplier?.warranty_terms_default || '',
      source_import_id: listing.supplier_import_id
    });

    await priceObservationRepo.record({
      supplier_id: listing.supplier_id,
      canonical_product_id: newProduct.id,
      price: listing.parsed_price,
      currency: listing.parsed_currency,
      price_in_base_currency: priceInBase,
      stock_quantity: stockQty,
      stock_status: listing.parsed_stock_status,
      source_import_id: listing.supplier_import_id,
      source: 'excel_import'
    });
  }
}

function parseStockQty(stockText) {
  if (!stockText) return 0;
  const text = String(stockText).toLowerCase().trim();
  const numMatch = text.match(/(\d+)/);
  if (numMatch) return parseInt(numMatch[1], 10);
  if (text.includes('in stock') || text.includes('available')) return 10;
  if (text.includes('50+') || text.includes('50 +')) return 50;
  return 0;
}
