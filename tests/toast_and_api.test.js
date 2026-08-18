import assert from 'assert';
import { parsePriceValue } from '../src/utils/priceParser.js';
import { ApiError } from '../src/services/apiClient.js';

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  TOAST, NOTIFICATION & API CLIENT INTEGRITY SUITE');
console.log('═══════════════════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}:`, err.message);
    failed++;
  }
}

// 1. Price Parser Robustness
runTest('parsePriceValue: standard integer', () => {
  assert.strictEqual(parsePriceValue('15000'), 15000);
});

runTest('parsePriceValue: with currency symbols and comma thousands', () => {
  assert.strictEqual(parsePriceValue('KES 15,450.00'), 15450.00);
  assert.strictEqual(parsePriceValue('$ 1,299.99'), 1299.99);
  assert.strictEqual(parsePriceValue('USD 350/-'), 350);
});

runTest('parsePriceValue: European comma decimal notation (1.250,50)', () => {
  assert.strictEqual(parsePriceValue('1.250,50'), 1250.50);
  assert.strictEqual(parsePriceValue('1250,50'), 1250.50);
});

runTest('parsePriceValue: returns NaN on non-numeric / empty text', () => {
  assert(isNaN(parsePriceValue('')));
  assert(isNaN(parsePriceValue('CALL FOR PRICE')));
  assert(isNaN(parsePriceValue('N/A')));
  assert(isNaN(parsePriceValue(null)));
  assert(isNaN(parsePriceValue(undefined)));
});

// 2. Import Row Skip Count Validation on Fixture Data
runTest('Import Fixture: accurately calculates skipped vs valid items', () => {
  const fixtureData = [
    { Name: 'Samsung 990 PRO 1TB SSD', SKU: 'MZ-V9S1T0BW', Price: 'KES 22,500', Stock: '15' },
    { Name: 'Samsung 990 PRO 2TB SSD', SKU: 'MZ-V9S2T0BW', Price: '2,400.00', Stock: '5' },
    { Name: '=== LAPTOPS CATEGORY ===', SKU: '', Price: '', Stock: '' }, // Skipped (no price/sku)
    { Name: 'Logitech MX Master 3S', SKU: '910-006556', Price: '120.00', Stock: '50+' },
    { Name: 'Dell XPS 15 9530', SKU: 'XPS-9530', Price: 'CALL FOR PRICE', Stock: '2' }, // Skipped (invalid price)
    { Name: '', SKU: 'HP-840-G10', Price: '950.00', Stock: '10' }, // Valid via fallback name=sku
    { Name: '', SKU: '', Price: '100.00', Stock: '1' }, // Skipped (no name, no sku)
    { Name: 'Discontinued Cable', SKU: 'CBL-01', Price: '-50.00', Stock: '0' } // Skipped (negative price)
  ];

  const mapping = { name: 'Name', sku: 'SKU', price: 'Price', stock: 'Stock' };
  const items = [];
  let skippedCount = 0;

  fixtureData.forEach((row) => {
    let name = String(row[mapping.name] ?? '').trim();
    const sku = mapping.sku ? String(row[mapping.sku] ?? '').trim() : '';
    if (!name && sku) name = sku;

    const price = parsePriceValue(row[mapping.price]);
    if (!name || isNaN(price) || price < 0) {
      skippedCount++;
      return;
    }
    items.push({ name, sku, price, stockRaw: row.Stock });
  });

  // Out of 8 rows: 4 valid, 4 skipped
  assert.strictEqual(items.length, 4, 'Expected exactly 4 valid products');
  assert.strictEqual(skippedCount, 4, 'Expected exactly 4 skipped rows');
  assert.strictEqual(items[0].name, 'Samsung 990 PRO 1TB SSD');
  assert.strictEqual(items[3].name, 'HP-840-G10', 'Fallback SKU should be used as name');
});

// 3. Typed ApiError Class Structure
runTest('ApiError: constructs status and message correctly', () => {
  const err403 = new ApiError('Permission denied', 403, { code: 'FORBIDDEN' });
  assert.strictEqual(err403.status, 403);
  assert.strictEqual(err403.message, 'Permission denied');
  assert.strictEqual(err403.name, 'ApiError');
  assert.strictEqual(err403.data.code, 'FORBIDDEN');
});

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════════════════════════\n');

if (failed > 0) process.exit(1);
