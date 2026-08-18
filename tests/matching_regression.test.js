import assert from 'node:assert/strict';
import { normalizeListing, calculateSimilarity } from '../server/productIdentityEngine.js';

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

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  PRODUCT IDENTITY & MATCHING REGRESSION SUITE (34 PAIRS)');
console.log('═══════════════════════════════════════════════════════════════\n');

// ── 1. The 4 Explicit Audit Regression Guard Cases ───────────────────────────
const auditRegressionGuards = [
  {
    a: "Samsung 990 PRO 1TB SSD",
    b: "Samsung T7 1TB Portable External SSD",
    expectMatch: false,
    reason: "same brand, different product line — MPN over-extraction guard"
  },
  {
    a: "Samsung 870 EVO 1TB SATA SSD",
    b: "Samsung 870 QVO 1TB SATA SSD",
    expectMatch: false,
    reason: "EVO (TLC) vs QVO (QLC) — different NAND, different product"
  },
  {
    a: "Logitech MX Master 3 Wireless Mouse",
    b: "Logitech MX Master 3S Wireless Mouse",
    expectMatch: false,
    reason: "3 vs 3S — different sensor generation"
  },
  {
    a: "Samsung 990 EVO SSD Drive 1TB",
    b: "SAMSUNG SSD 1TB NVME 990 EVO PLUS",
    expectMatch: false,
    reason: "EVO vs EVO Plus — regression guard for the original catch"
  }
];

// ── 2. Comprehensive 30-Pair Benchmark ───────────────────────────────────────
const benchmarkPairs = [
  // (a) True matches with very different wording (10 pairs)
  { a: "Samsung 990 EVO Plus 1TB PCIe 4.0 M.2 NVMe SSD", b: "SAMSUNG SSD 1TB NVME 990 EVO PLUS", expectMatch: true, reason: "Samsung 990 EVO Plus differently worded" },
  { a: "Samsung Solid State Drive 990 EVO Plus 1TB NVMe", b: "Samsung 990 EVO Plus 1TB M.2 PCIe Gen 4", expectMatch: true, reason: "Samsung 990 EVO Plus SSD" },
  { a: "Dell XPS 15 Laptop i7 16GB 512GB SSD", b: "Dell XPS 15 9530 Core i7-13700H 16/512GB", expectMatch: true, reason: "Dell XPS 15" },
  { a: "Apple MacBook Pro 14 M3 8-Core 8GB 512GB Space Gray", b: "MacBook Pro 14 M3 512GB - Space Gray", expectMatch: true, reason: "Apple MacBook Pro 14 M3" },
  { a: "Logitech MX Master 3S Wireless Performance Mouse Black", b: "Logitech MX Master 3S Mouse Graphite", expectMatch: true, reason: "Logitech MX Master 3S" },
  { a: "Crucial P3 Plus 1TB PCIe M.2 2280 SSD", b: "CRUCIAL SSD 1TB P3 PLUS NVME", expectMatch: true, reason: "Crucial P3 Plus 1TB" },
  { a: "Kingston NV2 2TB M.2 2280 NVMe PCIe Internal SSD", b: "KINGSTON 2TB NV2 NVME SOLID STATE DRIVE", expectMatch: true, reason: "Kingston NV2 2TB" },
  { a: "WD Black SN850X 1TB NVMe Gaming SSD", b: "Western Digital 1TB SN850X PCIe 4.0 NVMe", expectMatch: true, reason: "WD SN850X 1TB" },
  { a: "Lenovo ThinkPad E14 Gen 5 Core i5 16GB 512GB", b: "ThinkPad E14 i5-1335U 16GB 512GB SSD 14 inch", expectMatch: true, reason: "Lenovo ThinkPad E14" },
  { a: "HP EliteBook 840 G10 14 inch i7 16GB 512GB", b: "HP Laptop EliteBook 840 G10 i7/16GB/512GB", expectMatch: true, reason: "HP EliteBook 840 G10" },

  // (b) True matches with near-identical wording (5 pairs)
  { a: "Samsung 980 PRO 1TB PCIe 4.0 NVMe M.2 SSD", b: "Samsung 980 PRO 1TB NVMe M.2 SSD", expectMatch: true, reason: "Samsung 980 PRO identical" },
  { a: "Apple MacBook Air 13 M2 8GB 256GB Midnight", b: "MacBook Air 13 M2 8GB 256GB Midnight", expectMatch: true, reason: "MacBook Air M2 identical" },
  { a: "Dell Latitude 5440 i5-1335U 8GB 256GB SSD", b: "Dell Latitude 5440 Core i5 8GB 256GB", expectMatch: true, reason: "Dell Latitude 5440" },
  { a: "Logitech MX Keys S Wireless Keyboard", b: "Logitech MX Keys S Keyboard Graphite", expectMatch: true, reason: "Logitech MX Keys S" },
  { a: "SanDisk Extreme Portable SSD 1TB V2", b: "SanDisk 1TB Extreme Portable SSD External", expectMatch: true, reason: "SanDisk Extreme 1TB" },

  // (c) Near-miss non-matches (different model variants) (6 pairs)
  { a: "Samsung 980 1TB NVMe M.2 SSD", b: "Samsung 980 PRO 1TB NVMe M.2 SSD", expectMatch: false, reason: "980 non-pro vs 980 PRO" },
  { a: "Samsung 970 EVO 1TB NVMe SSD", b: "Samsung 970 EVO Plus 1TB NVMe SSD", expectMatch: false, reason: "970 EVO vs 970 EVO Plus" },
  { a: "Apple MacBook Pro 14 M3 512GB", b: "Apple MacBook Pro 14 M3 Pro 512GB", expectMatch: false, reason: "MacBook M3 Base vs M3 Pro" },
  { a: "iPhone 15 128GB Black", b: "iPhone 15 Pro 128GB Black", expectMatch: false, reason: "iPhone 15 Base vs Pro" },
  { a: "iPad Air 11 M2 128GB", b: "iPad Pro 11 M4 128GB", expectMatch: false, reason: "iPad Air vs iPad Pro" },
  { a: "Apple MacBook Pro 16 M3 Max 1TB", b: "Apple MacBook Air 15 M3 1TB", expectMatch: false, reason: "MBP 16 M3 Max vs MBA 15 M3" },

  // (d) Same brand + capacity but completely different products (6 pairs)
  { a: "Dell XPS 15 16GB 512GB SSD Laptop", b: "Dell Latitude 5540 16GB 512GB Laptop", expectMatch: false, reason: "Dell XPS vs Dell Latitude (Same RAM/Storage)" },
  { a: "Dell Inspiron 15 8GB 512GB", b: "Dell Vostro 15 8GB 512GB", expectMatch: false, reason: "Dell Inspiron vs Dell Vostro" },
  { a: "HP EliteBook 840 16GB 512GB", b: "HP ProBook 450 16GB 512GB", expectMatch: false, reason: "HP EliteBook vs HP ProBook" },
  { a: "Samsung Galaxy S24 256GB", b: "Samsung Galaxy A55 256GB", expectMatch: false, reason: "Galaxy S24 Flagship vs Galaxy A55 Budget" },
  { a: "Crucial P3 1TB NVMe SSD", b: "Crucial X6 1TB Portable SSD", expectMatch: false, reason: "Crucial Internal M.2 vs External Portable" },
  { a: "Lenovo ThinkPad T14 16GB 512GB", b: "Lenovo IdeaPad 3 16GB 512GB", expectMatch: false, reason: "ThinkPad vs IdeaPad" },

  // (e) Conflicting capacities on identical models (3 pairs)
  { a: "Samsung 990 EVO Plus 1TB SSD", b: "Samsung 990 EVO Plus 2TB SSD", expectMatch: false, reason: "990 EVO Plus 1TB vs 2TB" },
  { a: "Dell XPS 15 i7 512GB SSD", b: "Dell XPS 15 i7 1TB SSD", expectMatch: false, reason: "Dell XPS 512GB vs 1TB" },
  { a: "MacBook Pro 14 M3 512GB", b: "MacBook Pro 14 M3 1TB", expectMatch: false, reason: "MacBook Pro 512GB vs 1TB" }
];

const allPairs = [...auditRegressionGuards, ...benchmarkPairs];

let tp = 0, tn = 0, fp = 0, fn = 0;

allPairs.forEach((pair, idx) => {
  test(`Pair #${idx + 1}: ${pair.reason}`, () => {
    const normA = normalizeListing({ raw_name: pair.a });
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
    const isMatch = sim.confidence >= 0.70;

    if (pair.expectMatch) {
      if (isMatch) tp++;
      else fn++;
      assert.ok(isMatch, `Expected MATCH (>=0.70) for "${pair.a}" vs "${pair.b}", got confidence ${sim.confidence}. Signals: ${sim.signals.join(' | ')}`);
    } else {
      if (!isMatch) tn++;
      else fp++;
      assert.ok(!isMatch, `Expected NO MATCH (<0.70) for "${pair.a}" vs "${pair.b}", got confidence ${sim.confidence}. Signals: ${sim.signals.join(' | ')}`);
    }
  });
});

const precision = tp / (tp + fp || 1);
const recall = tp / (tp + fn || 1);
const accuracy = (tp + tn) / allPairs.length;

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  RESULTS: ${passed} passed, ${failed} failed (${allPairs.length} total pairs)`);
console.log(`  True Positives:     ${tp}`);
console.log(`  True Negatives:     ${tn}`);
console.log(`  False Positives:    ${fp}`);
console.log(`  False Negatives:    ${fn}`);
console.log(`  Precision:          ${(precision * 100).toFixed(1)}%`);
console.log(`  Recall:             ${(recall * 100).toFixed(1)}%`);
console.log(`  Accuracy:           ${(accuracy * 100).toFixed(1)}%`);
console.log('═══════════════════════════════════════════════════════════════\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 All matching regression guard tests passed cleanly!\n');
  process.exit(0);
}
