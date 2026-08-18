import { productRepo, offerRepo, priceObservationRepo } from './repositories/index.js';
import { query, get, run } from './db.js';
import { convertToBaseCurrency, getExchangeRates } from './fxService.js';

/**
 * Product Identity Engine (v3.2 Fail-Closed Disambiguation)
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
  // Samsung SSDs
  /\b(990\s*EVO\s*(?:\+|PLUS))\b/i,
  /\b(990\s*PRO\s*(?:PLUS|\+)?)\b/i,
  /\b(990\s*EVO)\b/i,
  /\b(980\s*PRO)\b/i,
  /\b(980\s*EVO)\b/i,
  /\b(980)\b/i,
  /\b(970\s*EVO\s*(?:\+|PLUS))\b/i,
  /\b(970\s*EVO)\b/i,
  /\b(970\s*PRO)\b/i,
  /\b(870\s*EVO)\b/i,
  /\b(870\s*QVO)\b/i,
  /\b(T\d{1,2}\s*(?:SHIELD|TOUCH|PORTABLE)?)\b/i,

  // Western Digital & Crucial & Kingston & SanDisk
  /\b(SN\s*850\s*X)\b/i,
  /\b(SN\s*770)\b/i,
  /\b(SN\s*580)\b/i,
  /\b(P3\s*PLUS)\b/i,
  /\b(P3)\b/i,
  /\b(X6|X8|X9|X10)\b/i,
  /\b(NV2|NV3|KC3000|A400)\b/i,
  /\b(EXTREME(?:\s*PRO|\s*PORTABLE)?)\b/i,

  // Laptops (Precedence order)
  /\b(MACBOOK\s*PRO\s*\d+(?:\s*(?:M[1234]\s*(?:PRO|MAX|ULTRA)?))?)\b/i,
  /\b(MACBOOK\s*AIR\s*\d+(?:\s*(?:M[1234]))?)\b/i,
  /\b(XPS\s*\d{2,4})\b/i,
  /\b(LATITUDE\s*\d{2,4})\b/i,
  /\b(INSPIRON\s*\d{2,4})\b/i,
  /\b(VOSTRO\s*\d{2,4})\b/i,
  /\b(THINKPAD\s*[A-Z]\d{1,2}(?:\s*GEN\s*\d+)?)\b/i,
  /\b(IDEAPAD\s*\d*)\b/i,
  /\b(ELITEBOOK\s*\d{2,4}(?:\s*G\d+)?)\b/i,
  /\b(PROBOOK\s*\d{2,4}(?:\s*G\d+)?)\b/i,

  // Peripherals
  /\b(MX\s*MASTER\s*3S)\b/i,
  /\b(MX\s*MASTER\s*3)\b/i,
  /\b(MX\s*KEYS\s*S)\b/i,
  /\b(MX\s*KEYS\s*MINI)\b/i,
  /\b(MX\s*KEYS)\b/i,

  // Mobile & Displays
  /\b(GALAXY\s*[AS]\d{1,2}(?:\s*ULTRA|\s*PLUS|\s*\+)?)\b/i,
  /\b(IPHONE\s*\d{1,2}\s*(?:PRO\s*MAX|PRO|PLUS|MAX)?)\b/i,
  /\b(IPAD\s*(?:PRO|AIR|MINI)?\s*(?:\d+)?)\b/i,
  /\b(SURFACE\s*(?:PRO|LAPTOP|GO)\s*\d*)\b/i,
  /\b(VIEWFINITY\s*[A-Z]*\d*)\b/i,
];

// Category precedence: Complex devices (Laptops/Phones) first, components second
const CATEGORY_RULES = [
  { category: 'Laptop', keywords: ['laptop', 'notebook', 'ultrabook', 'macbook', 'thinkpad', 'xps', 'latitude', 'elitebook', 'inspiron', 'probook', 'vostro', 'ideapad'] },
  { category: 'Phone', keywords: ['smartphone', 'iphone', 'galaxy s', 'galaxy a', 'pixel'] },
  { category: 'Tablet', keywords: ['tablet', 'ipad', 'surface pro', 'surface go'] },
  { category: 'Keyboard', keywords: ['keyboard', 'keycaps', 'mechanical keyboard', 'mx keys'] },
  { category: 'Mouse', keywords: ['mouse', 'mice', 'trackpad', 'mx master'] },
  { category: 'Monitor', keywords: ['monitor', 'display', 'screen', 'viewfinity'] },
  { category: 'SSD', keywords: ['ssd', 'solid state', 'nvme', 'm.2', 'sata drive', 'pcie 4.0', 'pcie 5.0'] },
  { category: 'HDD', keywords: ['hdd', 'hard drive', 'hard disk'] },
  { category: 'RAM', keywords: ['ram', 'ddr4', 'ddr5', 'memory module', 'dimm', 'sodimm'] },
  { category: 'Printer', keywords: ['printer', 'scanner', 'multifunction', 'laser printer', 'inkjet'] },
  { category: 'Router', keywords: ['router', 'access point', 'switch', 'firewall', 'mikrotik', 'ubiquiti'] },
  { category: 'GPU', keywords: ['gpu', 'graphics card', 'geforce', 'radeon', 'rtx', 'gtx'] },
  { category: 'CPU', keywords: ['cpu', 'processor', 'core i', 'ryzen', 'xeon'] },
  { category: 'Cable', keywords: ['cable', 'adapter', 'dongle', 'hub', 'dock'] },
  { category: 'Power', keywords: ['ups', 'power supply', 'psu', 'battery', 'charger'] }
];

// Equivalence list for synonymous wording tokens that do NOT represent different products
const EQUIVALENT_TOKEN_GROUPS = [
  new Set(['SSD', 'SOLID', 'STATE', 'DRIVE']),
  new Set(['WIFI', 'WIRELESS']),
  new Set(['BT', 'BLUETOOTH']),
  new Set(['GEN4', 'GEN', '4', 'PCIE4', 'PCIE40', 'PCIE']),
  new Set(['GEN5', 'GEN', '5', 'PCIE5', 'PCIE50']),
  new Set(['NVME', 'M2']),
  new Set(['INCH', 'INCHES', '14INCH', '13INCH', '15INCH', '16INCH']),
  new Set(['LAPTOP', 'NOTEBOOK'])
];

function areTokensEquivalent(tokenA, tokenB) {
  if (tokenA === tokenB) return true;
  for (const group of EQUIVALENT_TOKEN_GROUPS) {
    if (group.has(tokenA) && group.has(tokenB)) return true;
  }
  return false;
}

function getModelTokens(str) {
  if (!str) return [];
  return String(str).toUpperCase()
    .replace(/\+/g, ' PLUS ')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

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
  const brand = KNOWN_BRANDS.find((b) => {
    const rx = new RegExp(`\\b${b}\\b`, 'i');
    return rx.test(upper);
  });
  if (brand) return brand === "WD" ? "WESTERN DIGITAL" : brand;

  // Infer brand from prominent product lines when brand name is omitted in listing title
  if (/\b(MACBOOK|IPHONE|IPAD|AIRPODS|IMAC|MAC\s*MINI)\b/i.test(upper)) return "APPLE";
  if (/\b(THINKPAD|IDEAPAD|LEGION|YOGA)\b/i.test(upper)) return "LENOVO";
  if (/\b(LATITUDE|INSPIRON|VOSTRO|PRECISION|OPTIPLEX)\b/i.test(upper)) return "DELL";
  if (/\b(ELITEBOOK|PROBOOK|PAVILION|OMEN|SPECTRE)\b/i.test(upper)) return "HP";
  if (/\b(GALAXY|VIEWFINITY|ODYSSEY)\b/i.test(upper)) return "SAMSUNG";

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
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.category;
    }
  }
  return 'Electronics';
}

export function extractSpecifications(text) {
  const upper = String(text || '').toUpperCase();
  const specs = {};

  // Extract all capacity tokens (e.g. 16GB RAM, 512GB SSD)
  const capMatches = [...upper.matchAll(/\b(\d+)\s*(TB|GB|MB)\b/g)];
  if (capMatches.length > 0) {
    const caps = capMatches.map((m) => `${m[1]}${m[2]}`);
    specs.capacities = caps;
    specs.capacity = caps[caps.length - 1];
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
  const procMatch = upper.match(/\b(CORE\s*I[3579]|I[3579]-?\d{4,5}[A-Z]*|RYZEN\s*[3579]|M[1234]\s*(?:PRO|MAX|ULTRA)?)\b/);
  if (procMatch) {
    specs.processor = procMatch[1].replace(/\s+/g, ' ').trim();
  }

  return specs;
}

export function extractIdentifiers(rawSku, rawName) {
  const identifiers = {};

  if (rawSku) {
    const normSku = normalizeSku(rawSku);
    const cleanCand = normSku.toUpperCase();
    const isBrand = KNOWN_BRANDS.some((b) => b.replace(/[^A-Z0-9]/g, '') === cleanCand);
    const isCapacityOnly = /^\d+(TB|GB|MB)$/i.test(normSku);
    if (!isBrand && !isCapacityOnly && normSku.length >= 3) {
      identifiers.supplierSku = rawSku;
      identifiers.mpn = normSku;
    }
  }

  // Real MPNs almost always contain digits or structured hyphens (e.g. MZ-V9S1T0BW, MRX33LL/A, MZV9S1T0BW, 910-006556, XPS15-9530-01)
  // Exclude pure capacity strings (\d+GB), pure alphabetic brand/category words, and KNOWN_BRANDS
  const mpnMatch = String(rawName || '').match(/\b([A-Z0-9]{2,5}[-][A-Z0-9]{2,}[A-Z0-9/]*|\b(?=[A-Z0-9]*\d)[A-Z0-9]{5,}[A-Z0-9/]*)\b/i);
  if (mpnMatch && mpnMatch[1].length >= 5) {
    const cand = mpnMatch[1].toUpperCase();
    const cleanCand = cand.replace(/[^A-Z0-9]/g, '');
    const isBrand = KNOWN_BRANDS.some((b) => b.replace(/[^A-Z0-9]/g, '') === cleanCand);
    const isCapacityOnly = /^\d+(TB|GB|MB)$/i.test(cleanCand);
    const hasDigit = /\d/.test(cand);

    if (!isBrand && !isCapacityOnly && hasDigit) {
      identifiers.detectedMpn = cand;
      if (!identifiers.mpn) {
        identifiers.mpn = normalizeSku(cand);
      }
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
 * Adversarially hardened with fail-closed model variant disambiguation.
 */
export function calculateSimilarity(normalized, canonical) {
  let totalScore = 0;
  let maxPossibleScore = 0;
  const signals = [];

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

  // 1. Brand match (Weight: 1.0)
  maxPossibleScore += 1.0;
  if (normalized.brand && cBrand) {
    if (normalized.brand.toUpperCase() === cBrand) {
      totalScore += 1.0;
      signals.push(`Brand match: ${normalized.brand}`);
    } else {
      // Conflicting brand -> Strict rejection
      return { confidence: 0.0, signals: [`Conflicting brands: ${normalized.brand} vs ${cBrand}`], explanation: 'Conflicting brands' };
    }
  }

  // 2. Model match (Weight: 2.0) — Fail-Closed Model Variant Disambiguation
  if (normalized.model || cModel) {
    maxPossibleScore += 2.0;
    if (normalized.model && cModel) {
      const normTokens = getModelTokens(normalized.model);
      const canTokens = getModelTokens(cModel);

      const isExact = normTokens.length === canTokens.length &&
        normTokens.every((t, i) => t === canTokens[i]);

      if (isExact) {
        totalScore += 2.0;
        signals.push(`Exact model match: ${normalized.model}`);
      } else {
        // Count occurrences of each token (multiset comparison)
        const countMap = (tokens) => {
          const m = {};
          tokens.forEach((t) => { m[t] = (m[t] || 0) + 1; });
          return m;
        };
        const normMap = countMap(normTokens);
        const canMap = countMap(canTokens);
        const allKeys = new Set([...Object.keys(normMap), ...Object.keys(canMap)]);

        const diffs = [];
        for (const k of allKeys) {
          const countNorm = normMap[k] || 0;
          const countCan = canMap[k] || 0;
          if (countNorm !== countCan) {
            // Check if this token is covered by equivalence
            const isEquiv = EQUIVALENT_TOKEN_GROUPS.some((g) => g.has(k));
            if (!isEquiv) {
              diffs.push(k);
            }
          }
        }

        // Handle optional Gen specification (e.g. ThinkPad E14 Gen 5 vs ThinkPad E14)
        const isGenOmission = diffs.length === 2 && diffs.includes('GEN');

        if (isGenOmission) {
          totalScore += 1.5;
          signals.push(`Model series match (generation unspecified): ${normalized.model} ≈ ${cModel}`);
        } else if (diffs.length > 0) {
          // FAIL-CLOSED RULE:
          // Any distinguishing suffix or modifier token that is not in the equivalence list
          // constitutes a model variant conflict by default (e.g. 990 EVO vs 990 EVO Plus,
          // 870 EVO vs 870 QVO, MX Master 3 vs 3S, MacBook Pro M3 vs M3 Pro).
          return {
            confidence: 0.20,
            signals: [`Model variant conflict: ${normalized.model} vs ${cModel}`],
            explanation: `Different model variants (${normalized.model} vs ${cModel})`
          };
        } else {
          totalScore += 2.0;
          signals.push(`Exact model match: ${normalized.model}`);
        }
      }
    } else if (!normalized.model && cModel) {
      const canModel = cModel.toUpperCase().replace(/\s+/g, '');
      const rawNameNorm = (normalized.normalizedName || '').toUpperCase().replace(/\s+/g, '');
      if (rawNameNorm.includes(canModel)) {
        totalScore += 1.5;
        signals.push(`Model mention in name: ${cModel}`);
      }
    }
  }

  // 3. Processor check (for laptops/PCs)
  const normProc = (normalized.specifications?.processor || '').toUpperCase();
  const canProc = (cSpecs.processor || cAttrs.processor || '').toUpperCase();
  if (normProc && canProc) {
    const cleanNorm = normProc.replace('CORE ', '').replace('-', '');
    const cleanCan = canProc.replace('CORE ', '').replace('-', '');
    const isExact = normProc === canProc;
    const isFamilyOverlap = cleanNorm.includes(cleanCan) || cleanCan.includes(cleanNorm);

    if (isExact) {
      totalScore += 0.5;
      signals.push(`Processor match: ${normProc}`);
    } else if (isFamilyOverlap) {
      totalScore += 0.4;
      signals.push(`Processor family match: ${normProc} ≈ ${canProc}`);
    } else {
      // Conflicting processor (e.g. M3 vs M3 Pro or i5 vs i7)
      return {
        confidence: 0.20,
        signals: [`Processor conflict: ${normProc} vs ${canProc}`],
        explanation: `Different processors (${normProc} vs ${canProc})`
      };
    }
  }

  // 4. SKU/MPN match (Weight: 1.5)
  const normMpn = normalized.identifiers.mpn || normalized.identifiers.detectedMpn;
  const canMpn = cIds.mpn || cIds.detectedMpn;

  if (normMpn || canMpn) {
    if (normMpn && canMpn) {
      maxPossibleScore += 1.5;
      if (normMpn === canMpn) {
        totalScore += 1.5;
        signals.push(`MPN exact match: ${normMpn}`);
      } else if (normMpn.includes(canMpn) || canMpn.includes(normMpn)) {
        totalScore += 1.0;
        signals.push(`MPN partial overlap: ${normMpn} ≈ ${canMpn}`);
      }
    }
  }

  // 5. Capacity match (Weight: 1.0)
  const normCaps = normalized.specifications.capacities || (normalized.specifications.capacity ? [normalized.specifications.capacity] : []);
  const canCaps = cSpecs.capacities || (cSpecs.capacity ? [cSpecs.capacity] : []);

  if (normCaps.length > 0 && canCaps.length > 0) {
    maxPossibleScore += 1.0;
    const hasOverlap = normCaps.some((nc) => canCaps.includes(nc));
    if (hasOverlap) {
      totalScore += 1.0;
      signals.push(`Capacity match: ${normCaps.filter((c) => canCaps.includes(c)).join(', ')}`);
    } else {
      // Conflicting capacity -> Strict penalty
      return {
        confidence: 0.15,
        signals: [`Capacity mismatch: ${normCaps.join('/')} vs ${canCaps.join('/')}`],
        explanation: `Different capacities (${normCaps.join('/')} vs ${canCaps.join('/')})`
      };
    }
  }

  // 6. Category match (Weight: 0.5)
  if (normalized.category && canonical.category) {
    maxPossibleScore += 0.5;
    if (normalized.category === canonical.category) {
      totalScore += 0.5;
      signals.push(`Category match: ${normalized.category}`);
    } else {
      const incompatible = (normalized.category === 'Mouse' && canonical.category === 'Keyboard') ||
                           (normalized.category === 'Laptop' && canonical.category === 'Phone') ||
                           (normalized.category === 'SSD' && canonical.category === 'Laptop');
      if (incompatible) {
        return {
          confidence: 0.10,
          signals: [`Category conflict: ${normalized.category} vs ${canonical.category}`],
          explanation: `Category conflict (${normalized.category} vs ${canonical.category})`
        };
      }
    }
  }

  if (maxPossibleScore === 0) maxPossibleScore = 1.0;
  const confidence = Math.min(1.0, Math.round((totalScore / maxPossibleScore) * 100) / 100);

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
  const rate = rates[listing.parsed_currency] || rates['USD'] || 1.0;
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
      `SELECT * FROM raw_listings WHERE canonical_product_id = ?`,
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
