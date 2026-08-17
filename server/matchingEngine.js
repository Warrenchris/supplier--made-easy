import { query, run, get } from './db.js';

const KNOWN_BRANDS = [
  "SAMSUNG", "DELL", "APPLE", "LOGITECH", "HP", "LENOVO", "CISCO", "SEAGATE",
  "WESTERN DIGITAL", "WD", "KINGSTON", "CRUCIAL", "SANDISK", "ASUS", "ACER",
  "TP-LINK", "MIKROTIK", "UBIQUITI", "EPSON", "CANON", "BROTHER", "SONY"
];

export function normalizeSku(sku) {
  if (!sku) return "";
  return String(sku).trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizeName(name) {
  if (!name) return "";
  return String(name).trim().toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

export function extractAttributes(rawName, rawSpecs = {}) {
  const text = `${rawName} ${typeof rawSpecs === 'string' ? rawSpecs : JSON.stringify(rawSpecs)}`.toUpperCase();
  const attributes = {};

  // Capacity extraction
  const capMatch = text.match(/\b(\d+)\s*(GB|TB|MB)\b/i);
  if (capMatch) {
    attributes.capacity = `${capMatch[1]}${capMatch[2].toUpperCase()}`;
  }

  // Interface extraction
  const intMatch = text.match(/\b(NVME|SATA|M\.2|PCIE|USB-C|THUNDERBOLT|HDMI|DISPLAYPORT)\b/i);
  if (intMatch) {
    attributes.interface = intMatch[1].toUpperCase();
  }

  // Brand extraction
  const brand = KNOWN_BRANDS.find((b) => text.includes(b));
  if (brand) {
    attributes.brand = brand === "WD" ? "WESTERN DIGITAL" : brand;
  }

  // Model series code extraction (e.g. 990 EVO PLUS, XPS 15, MX MASTER 3S)
  const modelMatch = text.match(/\b(990\s*EVO\s*PLUS|980\s*PRO|XPS\s*15|M3\s*PRO|MX\s*MASTER\s*3S|T450|S8|VIEWFINITY)\b/i);
  if (modelMatch) {
    attributes.model_series = modelMatch[1].toUpperCase();
  }

  return attributes;
}

export function calculateTokenJaccard(nameA, nameB) {
  const tokensA = new Set(normalizeName(nameA).split(" ").filter((t) => t.length > 1));
  const tokensB = new Set(normalizeName(nameB).split(" ").filter((t) => t.length > 1));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let inter = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) inter++;
  }
  const union = tokensA.size + tokensB.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function evaluateSemanticMatch(listingA, listingB) {
  const normA = normalizeName(listingA.raw_name);
  const normB = normalizeName(listingB.raw_name);
  const skuA = normalizeSku(listingA.raw_sku);
  const skuB = normalizeSku(listingB.raw_sku);

  const attrsA = extractAttributes(listingA.raw_name, listingA.raw_specs);
  const attrsB = extractAttributes(listingB.raw_name, listingB.raw_specs);

  const jaccard = calculateTokenJaccard(listingA.raw_name, listingB.raw_name);
  const signals = [];
  let score = jaccard * 0.4;

  // Exact SKU match
  if (skuA && skuB && skuA === skuB) {
    score = 1.0;
    signals.push(`Exact SKU match: ${skuA}`);
  } else if (skuA && skuB && (skuA.includes(skuB) || skuB.includes(skuA))) {
    score += 0.35;
    signals.push(`Partial SKU overlap: ${skuA} / ${skuB}`);
  }

  // Brand Match
  if (attrsA.brand && attrsB.brand && attrsA.brand === attrsB.brand) {
    score += 0.20;
    signals.push(`Brand match: ${attrsA.brand}`);
  }

  // Model Series Match
  if (attrsA.model_series && attrsB.model_series && attrsA.model_series === attrsB.model_series) {
    score += 0.25;
    signals.push(`Model series match: ${attrsA.model_series}`);
  }

  // Capacity & Spec Match
  if (attrsA.capacity && attrsB.capacity && attrsA.capacity === attrsB.capacity) {
    score += 0.15;
    signals.push(`Capacity match: ${attrsA.capacity}`);
  }

  if (attrsA.interface && attrsB.interface && attrsA.interface === attrsB.interface) {
    score += 0.10;
    signals.push(`Interface match: ${attrsA.interface}`);
  }

  const confidence = Math.min(1.0, Math.round(score * 100) / 100);

  const explanation = signals.length > 0
    ? `Matches based on ${signals.join(" · ")}`
    : `Token similarity ${Math.round(jaccard * 100)}%`;

  return {
    confidence,
    matching_signals: {
      brand_match: attrsA.brand && attrsB.brand && attrsA.brand === attrsB.brand,
      brand: attrsA.brand || attrsB.brand || null,
      model_series: attrsA.model_series || attrsB.model_series || null,
      capacity: attrsA.capacity || attrsB.capacity || null,
      interface: attrsA.interface || attrsB.interface || null,
      token_jaccard: jaccard,
      signals,
      explanation
    }
  };
}

export async function processListingMatching(rawListingId) {
  const listing = await get(`SELECT * FROM raw_listings WHERE id = ?`, [rawListingId]);
  if (!listing) return;

  const otherListings = await query(
    `SELECT * FROM raw_listings WHERE id != ? AND supplier_id != ? AND canonical_product_id IS NOT NULL`,
    [listing.id, listing.supplier_id]
  );

  let bestMatch = null;
  let maxScore = 0;

  for (const other of otherListings) {
    const evaluation = evaluateSemanticMatch(listing, other);
    if (evaluation.confidence > maxScore) {
      maxScore = evaluation.confidence;
      bestMatch = {
        otherListing: other,
        canonical_product_id: other.canonical_product_id,
        evaluation
      };
    }
  }

  const autoConfirmThreshold = 0.90;
  const reviewThreshold = 0.50;

  if (bestMatch && bestMatch.evaluation.confidence >= autoConfirmThreshold) {
    // Auto-confirm match
    await run(
      `UPDATE raw_listings SET canonical_product_id = ?, match_confidence = ?, match_status = 'confirmed' WHERE id = ?`,
      [bestMatch.canonical_product_id, bestMatch.evaluation.confidence, listing.id]
    );

    await run(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, before, after)
       VALUES (?, 'sys_auto', 'AUTO_CONFIRM_MATCH', 'raw_listing', ?, '{}', ?)`,
      [
        `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        listing.id,
        JSON.stringify({ canonical_product_id: bestMatch.canonical_product_id, confidence: bestMatch.evaluation.confidence })
      ]
    );
  } else if (bestMatch && bestMatch.evaluation.confidence >= reviewThreshold) {
    // Surface in Match Review Queue
    const sugId = `sug_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await run(
      `INSERT INTO match_suggestions (id, raw_listing_a_id, raw_listing_b_id, canonical_product_id, similarity_score, matching_signals, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [
        sugId,
        listing.id,
        bestMatch.otherListing.id,
        bestMatch.canonical_product_id,
        bestMatch.evaluation.confidence,
        JSON.stringify(bestMatch.evaluation.matching_signals)
      ]
    );

    await run(
      `UPDATE raw_listings SET match_confidence = ?, match_status = 'suggested' WHERE id = ?`,
      [bestMatch.evaluation.confidence, listing.id]
    );
  } else {
    // Create new Canonical Product for standalone item
    const cpId = `cp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const attrs = extractAttributes(listing.raw_name, listing.raw_specs);
    await run(
      `INSERT INTO canonical_products (id, canonical_name, brand, category, model_number, attributes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        cpId,
        listing.raw_name,
        attrs.brand || "Generic",
        listing.category_tag || "Electronics",
        attrs.model_series || listing.raw_sku || "",
        JSON.stringify(attrs)
      ]
    );

    await run(
      `UPDATE raw_listings SET canonical_product_id = ?, match_confidence = 1.0, match_status = 'confirmed' WHERE id = ?`,
      [cpId, listing.id]
    );
  }
}
