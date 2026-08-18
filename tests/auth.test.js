import assert from 'node:assert/strict';
import express from 'express';
import apiRouter from '../server/api.js';
import { generateToken, PRESET_USERS } from '../server/auth.js';
import { getStore, query, run } from '../server/db.js';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  SECURITY, AUTHENTICATION & ROLE ENFORCEMENT TEST SUITE');
console.log('═══════════════════════════════════════════════════════════════\n');

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

const server = app.listen(0);
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}/api`;

const adminToken = generateToken(PRESET_USERS.admin);
const buyerToken = generateToken(PRESET_USERS.buyer);
const viewerToken = generateToken(PRESET_USERS.viewer);

async function request(path, options = {}) {
  const headers = { 'Connection': 'close', ...(options.headers || {}) };
  return fetch(`${baseUrl}${path}`, { ...options, headers });
}

async function runTests() {
  // Test 1: Unauthenticated request to admin write endpoint returns 401
  await test('Unauthenticated POST /api/exchange-rates is rejected with 401', async () => {
    const res = await request('/exchange-rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currency_code: 'USD', rate_to_base: 130.0 })
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.ok(body.error.includes('Unauthorized'));
  });

  // Test 2: Viewer token to admin write endpoint returns 403
  await test('Viewer token POST /api/exchange-rates is rejected with 403 Forbidden', async () => {
    const res = await request('/exchange-rates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${viewerToken}`
      },
      body: JSON.stringify({ currency_code: 'USD', rate_to_base: 130.0 })
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.ok(body.error.includes('Forbidden'));
  });

  // Test 3: Admin token to admin write endpoint succeeds with 200
  await test('Admin token POST /api/exchange-rates succeeds with 200 & writes audit log', async () => {
    const res = await request('/exchange-rates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ currency_code: 'EUR', rate_to_base: 142.5 })
    });
    assert.equal(res.status, 200);

    const logs = await query(`SELECT * FROM audit_logs WHERE action = 'UPDATE_EXCHANGE_RATE' ORDER BY created_at DESC LIMIT 1`);
    assert.ok(logs.length > 0);
    assert.equal(logs[0].user_id, PRESET_USERS.admin.id);
  });

  // Test 4: Viewer token cannot approve match suggestions (403)
  await test('Viewer token POST /api/match-suggestions/sug_test/approve is rejected with 403', async () => {
    const res = await request('/match-suggestions/sug_test/approve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${viewerToken}`
      }
    });
    assert.equal(res.status, 403);
  });

  // Test 5: Buyer token can approve match suggestions
  await test('Buyer token can approve match suggestion and logs user_id', async () => {
    const sugId = `sug_${Date.now()}`;
    const rlId = `rl_${Date.now()}`;
    await run(`INSERT INTO raw_listings (id, raw_name, parsed_price, parsed_currency) VALUES (?, 'Test Listing', 100, 'USD')`, [rlId]);
    await run(`INSERT INTO match_suggestions (id, raw_listing_a_id, status) VALUES (?, ?, 'pending')`, [sugId, rlId]);

    const res = await request(`/match-suggestions/${sugId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      }
    });
    assert.equal(res.status, 200);

    const logs = await query(`SELECT * FROM audit_logs WHERE action = 'APPROVE_MATCH' AND entity_id = ?`, [sugId]);
    assert.ok(logs.length > 0);
    assert.equal(logs[0].user_id, PRESET_USERS.buyer.id);
  });

  // Test 6: Split migration moves offers and price observations to new canonical product
  await test('Product split migrates offers & observations to new canonical product', async () => {
    const rlId = `rl_split_${Date.now()}`;
    const oldCpId = `cp_old_${Date.now()}`;
    const impId = `imp_${Date.now()}`;
    const supId = `sup_${Date.now()}`;

    const store = getStore();
    store.raw_listings.push({
      id: rlId,
      supplier_import_id: impId,
      supplier_id: supId,
      raw_name: 'Split Item Pro',
      raw_sku: 'SKU-SPLIT-1',
      parsed_price: 500,
      parsed_currency: 'USD',
      canonical_product_id: oldCpId,
      match_status: 'confirmed'
    });
    store.supplier_offers.push({
      id: `off_${rlId}`,
      raw_listing_id: rlId,
      canonical_product_id: oldCpId,
      supplier_id: supId,
      cost: 500
    });
    store.price_observations.push({
      id: `obs_${rlId}`,
      source_import_id: impId,
      supplier_id: supId,
      canonical_product_id: oldCpId,
      price: 500
    });

    const res = await request('/products/split', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ rawListingId: rlId })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    const newCpId = data.newCanonicalProductId;
    assert.ok(newCpId && newCpId !== oldCpId);

    // Verify offer migrated
    const migratedOffer = store.supplier_offers.find((o) => o.raw_listing_id === rlId);
    assert.equal(migratedOffer.canonical_product_id, newCpId);

    // Verify observation migrated
    const migratedObs = store.price_observations.find((p) => p.source_import_id === impId && p.supplier_id === supId);
    assert.equal(migratedObs.canonical_product_id, newCpId);

    // Verify audit log
    const logs = await query(`SELECT * FROM audit_logs WHERE action = 'SPLIT_PRODUCT' AND entity_id = ?`, [newCpId]);
    assert.ok(logs.length > 0);
    assert.equal(logs[0].user_id, PRESET_USERS.buyer.id);
  });

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  server.close();
}

runTests();
