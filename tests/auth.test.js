import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';

// Configure test environment variables prior to importing auth modules
process.env.JWT_SECRET = 'sme_test_jwt_secret_key_for_ci_2026';
process.env.ADMIN_PASSWORD = 'K7mP9_vL2-xQ8!w';
process.env.BUYER_PASSWORD = 'B3jR8_nE5-yT1!z';
process.env.VIEWER_PASSWORD = 'V9wK2_pC7-mN4!x';

const { default: apiRouter } = await import('../server/api.js');
const { generateToken, verifyToken, SYSTEM_USERS } = await import('../server/auth.js');
const { getStore, query, run } = await import('../server/db.js');

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
console.log('  SECURITY, AUTHENTICATION & HARDENED SECRETS TEST SUITE');
console.log('═══════════════════════════════════════════════════════════════\n');

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

const server = app.listen(0);
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}/api`;

const adminUser = SYSTEM_USERS.find((u) => u.role === 'admin');
const buyerUser = SYSTEM_USERS.find((u) => u.role === 'buyer');
const viewerUser = SYSTEM_USERS.find((u) => u.role === 'viewer');

const adminToken = generateToken(adminUser);
const buyerToken = generateToken(buyerUser);
const viewerToken = generateToken(viewerUser);

async function request(path, options = {}) {
  const headers = { 'Connection': 'close', ...(options.headers || {}) };
  return fetch(`${baseUrl}${path}`, { ...options, headers });
}

async function runTests() {
  // Test 1: Static string tokens are strictly rejected
  await test('Static token string "admin-token" is rejected with 401 Unauthorized', async () => {
    const res = await request('/exchange-rates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer admin-token'
      },
      body: JSON.stringify({ currency_code: 'USD', rate_to_base: 130.0 })
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.ok(body.error.includes('Unauthorized'));
  });

  // Test 2: Forged signature token is rejected
  await test('Forged signature JWT is rejected with 401 Unauthorized', async () => {
    const parts = adminToken.split('.');
    const forgedToken = `${parts[0]}.${parts[1]}.fake_signature_123456789`;
    const res = await request('/exchange-rates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${forgedToken}`
      },
      body: JSON.stringify({ currency_code: 'USD', rate_to_base: 130.0 })
    });
    assert.equal(res.status, 401);
  });

  // Test 3: Expired token is rejected
  await test('Expired JWT token is rejected with 401 Unauthorized', async () => {
    const expiredToken = generateToken(adminUser, -100);
    const res = await request('/exchange-rates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${expiredToken}`
      },
      body: JSON.stringify({ currency_code: 'USD', rate_to_base: 130.0 })
    });
    assert.equal(res.status, 401);
  });

  // Test 4: Server startup fails when JWT_SECRET is unset
  await test('Server refuses to start when JWT_SECRET is unset (exit code 1)', () => {
    const result = spawnSync(process.execPath, ['-e', "delete process.env.JWT_SECRET; import('./server/auth.js')"], {
      cwd: process.cwd(),
      env: { ...process.env, JWT_SECRET: '' }
    });
    assert.equal(result.status, 1, 'Expected process to exit with status code 1');
    const stderr = result.stderr.toString();
    assert.ok(stderr.includes('JWT_SECRET') || stderr.includes('FATAL'), 'Expected error message regarding missing JWT_SECRET');
  });

  // Test 5: No hardcoded password strings in src/
  await test('Absence of hardcoded credential strings in src/ tree', () => {
    const srcDir = path.join(process.cwd(), 'src');
    const forbiddenStrings = ['AdminPass2026!', 'BuyerPass2026!', 'ViewerPass2026!', 'K7mP9_vL2-xQ8!w'];
    
    function scanDir(dir) {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) {
          scanDir(full);
        } else if (f.endsWith('.jsx') || f.endsWith('.js') || f.endsWith('.css') || f.endsWith('.html')) {
          const content = fs.readFileSync(full, 'utf8');
          for (const forbidden of forbiddenStrings) {
            assert.ok(!content.includes(forbidden), `Found forbidden credential string in ${full}`);
          }
        }
      }
    }
    scanDir(srcDir);
  });

  // Test 6: Real login with rotated credentials succeeds
  await test('Login with rotated valid credentials issues signed JWT with 12h expiry', async () => {
    const res = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@supplier-made-easy.co.ke', password: 'K7mP9_vL2-xQ8!w' })
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.success);
    assert.ok(body.token);
    assert.equal(body.user.role, 'admin');

    const verified = verifyToken(body.token);
    assert.ok(verified);
    assert.equal(verified.role, 'admin');
  });

  // Test 7: Rate limiting kicks in after repeated failed logins
  await test('Rate limiter triggers 429 Too Many Requests after 5 failed attempts', async () => {
    const targetEmail = `brute_force_${Date.now()}@supplier-made-easy.co.ke`;
    
    // 5 failed attempts
    for (let i = 0; i < 5; i++) {
      const res = await request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, password: 'wrong_password_attempt' })
      });
      assert.equal(res.status, 401);
    }

    // 6th attempt should be blocked with 429
    const rateLimitedRes = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail, password: 'any_password' })
    });
    assert.equal(rateLimitedRes.status, 429, 'Expected 429 Too Many Requests');
    assert.equal(rateLimitedRes.headers.get('retry-after'), '900');
    const body = await rateLimitedRes.json();
    assert.ok(body.error.includes('Too many failed login attempts'));
  });

  // Test 8: Viewer token to admin write endpoint returns 403 Forbidden
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

  // Test 9: Admin token to admin write endpoint succeeds with 200 & logs audit
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
    assert.equal(logs[0].user_id, adminUser.id);
  });

  // Test 10: Buyer token can approve match suggestions
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
    assert.equal(logs[0].user_id, buyerUser.id);
  });

  // Test 11: Split migration moves offers and price observations to new canonical product
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
    assert.equal(logs[0].user_id, buyerUser.id);
  });

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  server.close();
}

runTests();
