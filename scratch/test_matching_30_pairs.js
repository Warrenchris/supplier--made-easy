import { normalizeListing, calculateSimilarity, normalizeName, extractBrand, extractModel, extractSpecifications, extractIdentifiers } from '../server/productIdentityEngine.js';
import { calculateSupplierIntelligence, getScoringWeights } from '../server/scoringEngine.js';

console.log('═══════════════════════════════════════════════════════════════');
console.log('  AUDIT TEST 1: MATCHING ENGINE 30+ PAIR PRECISION & RECALL');
console.log('═══════════════════════════════════════════════════════════════\n');

const testPairs = [
  // ── (a) True matches with very different wording (10 pairs) ───────────────
  { a: "Samsung 990 EVO Plus 1TB PCIe 4.0 M.2 NVMe SSD", b: "SAMSUNG SSD 1TB NVME 990 EVO PLUS", shouldMatch: true, desc: "Samsung 990 EVO Plus differently worded" },
  { a: "Samsung Solid State Drive 990 EVO Plus 1TB NVMe", b: "Samsung 990 EVO Plus 1TB M.2 PCIe Gen 4", shouldMatch: true, desc: "Samsung 990 EVO Plus SSD" },
  { a: "Dell XPS 15 Laptop i7 16GB 512GB SSD", b: "Dell XPS 15 9530 Core i7-13700H 16/512GB", shouldMatch: true, desc: "Dell XPS 15" },
  { a: "Apple MacBook Pro 14 M3 8-Core 8GB 512GB Space Gray", b: "MacBook Pro 14 M3 512GB - Space Gray", shouldMatch: true, desc: "Apple MacBook Pro 14 M3" },
  { a: "Logitech MX Master 3S Wireless Performance Mouse Black", b: "Logitech MX Master 3S Mouse Graphite", shouldMatch: true, desc: "Logitech MX Master 3S" },
  { a: "Crucial P3 Plus 1TB PCIe M.2 2280 SSD", b: "CRUCIAL SSD 1TB P3 PLUS NVME", shouldMatch: true, desc: "Crucial P3 Plus 1TB" },
  { a: "Kingston NV2 2TB M.2 2280 NVMe PCIe Internal SSD", b: "KINGSTON 2TB NV2 NVME SOLID STATE DRIVE", shouldMatch: true, desc: "Kingston NV2 2TB" },
  { a: "WD Black SN850X 1TB NVMe Gaming SSD", b: "Western Digital 1TB SN850X PCIe 4.0 NVMe", shouldMatch: true, desc: "WD SN850X 1TB" },
  { a: "Lenovo ThinkPad E14 Gen 5 Core i5 16GB 512GB", b: "ThinkPad E14 i5-1335U 16GB 512GB SSD 14 inch", shouldMatch: true, desc: "Lenovo ThinkPad E14" },
  { a: "HP EliteBook 840 G10 14 inch i7 16GB 512GB", b: "HP Laptop EliteBook 840 G10 i7/16GB/512GB", shouldMatch: true, desc: "HP EliteBook 840 G10" },

  // ── (b) True matches with near-identical wording (5 pairs) ────────────────
  { a: "Samsung 980 PRO 1TB PCIe 4.0 NVMe M.2 SSD", b: "Samsung 980 PRO 1TB NVMe M.2 SSD", shouldMatch: true, desc: "Samsung 980 PRO identical" },
  { a: "Apple MacBook Air 13 M2 8GB 256GB Midnight", b: "MacBook Air 13 M2 8GB 256GB Midnight", shouldMatch: true, desc: "MacBook Air M2 identical" },
  { a: "Dell Latitude 5440 i5-1335U 8GB 256GB SSD", b: "Dell Latitude 5440 Core i5 8GB 256GB", shouldMatch: true, desc: "Dell Latitude 5440" },
  { a: "Logitech MX Keys S Wireless Keyboard", b: "Logitech MX Keys S Keyboard Graphite", shouldMatch: true, desc: "Logitech MX Keys S" },
  { a: "SanDisk Extreme Portable SSD 1TB V2", b: "SanDisk 1TB Extreme Portable SSD External", shouldMatch: true, desc: "SanDisk Extreme 1TB" },

  // ── (c) Near-miss non-matches (different model variants) (8 pairs) ─────────
  { a: "Samsung 990 EVO SSD Drive 1TB", b: "SAMSUNG SSD 1TB NVME 990 EVO PLUS", shouldMatch: false, desc: "990 EVO vs 990 EVO PLUS (Crucial test case)" },
  { a: "Samsung 980 1TB NVMe M.2 SSD", b: "Samsung 980 PRO 1TB NVMe M.2 SSD", shouldMatch: false, desc: "980 non-pro vs 980 PRO" },
  { a: "Samsung 970 EVO 1TB NVMe SSD", b: "Samsung 970 EVO Plus 1TB NVMe SSD", shouldMatch: false, desc: "970 EVO vs 970 EVO Plus" },
  { a: "Samsung 870 EVO 1TB SATA SSD", b: "Samsung 870 QVO 1TB SATA SSD", shouldMatch: false, desc: "870 EVO (TLC) vs 870 QVO (QLC)" },
  { a: "Apple MacBook Pro 14 M3 512GB", b: "Apple MacBook Pro 14 M3 Pro 512GB", shouldMatch: false, desc: "MacBook M3 Base vs M3 Pro" },
  { a: "Logitech MX Master 3 Mouse", b: "Logitech MX Master 3S Mouse", shouldMatch: false, desc: "MX Master 3 vs MX Master 3S" },
  { a: "iPhone 15 128GB Black", b: "iPhone 15 Pro 128GB Black", shouldMatch: false, desc: "iPhone 15 Base vs Pro" },
  { a: "iPad Air 11 M2 128GB", b: "iPad Pro 11 M4 128GB", shouldMatch: false, desc: "iPad Air vs iPad Pro" },

  // ── (d) Same brand + capacity but completely different products (7 pairs) ──
  { a: "Dell XPS 15 16GB 512GB SSD Laptop", b: "Dell Latitude 5540 16GB 512GB Laptop", shouldMatch: false, desc: "Dell XPS vs Dell Latitude (Same RAM/Storage)" },
  { a: "Dell Inspiron 15 8GB 512GB", b: "Dell Vostro 15 8GB 512GB", shouldMatch: false, desc: "Dell Inspiron vs Dell Vostro" },
  { a: "HP EliteBook 840 16GB 512GB", b: "HP ProBook 450 16GB 512GB", shouldMatch: false, desc: "HP EliteBook vs HP ProBook" },
  { a: "Samsung Galaxy S24 256GB", b: "Samsung Galaxy A55 256GB", shouldMatch: false, desc: "Galaxy S24 Flagship vs Galaxy A55 Budget" },
  { a: "Samsung 990 PRO 1TB SSD", b: "Samsung T7 1TB Portable External SSD", shouldMatch: false, desc: "Internal NVMe vs External Portable SSD" },
  { a: "Apple MacBook Pro 16 M3 Max 1TB", b: "Apple MacBook Air 15 M3 1TB", shouldMatch: false, desc: "MBP 16 M3 Max vs MBA 15 M3" },
  { a: "Crucial P3 1TB NVMe SSD", b: "Crucial X6 1TB Portable SSD", shouldMatch: false, desc: "Crucial Internal M.2 vs External Portable" },

  // ── (e) Conflicting capacities on identical models (3 pairs) ──────────────
  { a: "Samsung 990 EVO Plus 1TB SSD", b: "Samsung 990 EVO Plus 2TB SSD", shouldMatch: false, desc: "990 EVO Plus 1TB vs 2TB" },
  { a: "Dell XPS 15 i7 512GB SSD", b: "Dell XPS 15 i7 1TB SSD", shouldMatch: false, desc: "Dell XPS 512GB vs 1TB" },
  { a: "MacBook Pro 14 M3 512GB", b: "MacBook Pro 14 M3 1TB", shouldMatch: false, desc: "MacBook Pro 512GB vs 1TB" }
];

let truePositives = 0;
let trueNegatives = 0;
let falsePositives = 0;
let falseNegatives = 0;

testPairs.forEach((pair, idx) => {
  const normA = normalizeListing({ raw_name: pair.a });
  
  // Construct canonical mock object from listing B
  const normB = normalizeListing({ raw_name: pair.b });
  const canonicalB = {
    id: `cp_test_${idx}`,
    canonical_name: pair.b,
    brand: normB.brand,
    model_number: normB.model,
    category: normB.category,
    specifications: normB.specifications,
    attributes: { ...normB.specifications, brand: normB.brand, model_series: normB.model },
    identifiers: normB.identifiers
  };

  const sim = calculateSimilarity(normA, canonicalB);
  const matched = sim.confidence >= 0.70; // High confidence match threshold

  const isCorrect = (matched === pair.shouldMatch);
  if (matched && pair.shouldMatch) truePositives++;
  if (!matched && !pair.shouldMatch) trueNegatives++;
  if (matched && !pair.shouldMatch) falsePositives++;
  if (!matched && pair.shouldMatch) falseNegatives++;

  const status = isCorrect ? 'PASS' : 'FAIL';
  console.log(`[${status}] Pair #${idx + 1}: ${pair.desc}`);
  console.log(`       A: "${pair.a}" (Brand: ${normA.brand}, Model: ${normA.model})`);
  console.log(`       B: "${pair.b}" (Brand: ${normB.brand}, Model: ${normB.model})`);
  console.log(`       Score: ${sim.confidence} (Expected: ${pair.shouldMatch ? 'MATCH (>=0.70)' : 'NO MATCH (<0.70)'})`);
  console.log(`       Signals: ${sim.signals.join(' | ')}`);
  if (!isCorrect) {
    console.log(`       ⚠️ MISCLASSIFICATION!`);
  }
  console.log('');
});

const precision = truePositives / (truePositives + falsePositives || 1);
const recall = truePositives / (truePositives + falseNegatives || 1);
const accuracy = (truePositives + trueNegatives) / testPairs.length;

console.log('═══════════════════════════════════════════════════════════════');
console.log('  TEST 1 RESULTS SUMMARY:');
console.log(`  Total Pairs Tested: ${testPairs.length}`);
console.log(`  True Positives:     ${truePositives}`);
console.log(`  True Negatives:     ${trueNegatives}`);
console.log(`  False Positives:    ${falsePositives}`);
console.log(`  False Negatives:    ${falseNegatives}`);
console.log(`  Precision:          ${(precision * 100).toFixed(1)}%`);
console.log(`  Recall:             ${(recall * 100).toFixed(1)}%`);
console.log(`  Accuracy:           ${(accuracy * 100).toFixed(1)}%`);
console.log('═══════════════════════════════════════════════════════════════\n');
