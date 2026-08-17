import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDb, run } from './db.js';
import apiRouter from './api.js';
import { processListing } from './productIdentityEngine.js';
import { priceObservationRepo } from './repositories/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ──────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Structured logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path !== '/api/health') {
      console.log(JSON.stringify({
        ts: new Date().toISOString(),
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Date.now() - start
      }));
    }
  });
  next();
});

app.use('/api', apiRouter);

// ─── Static Frontend (Production) ──────────────────────────────────────────

const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ─── Seed Dataset ───────────────────────────────────────────────────────────

async function seedDefaultDataset() {
  const { get } = await import('./db.js');
  const existingCount = await get(`SELECT COUNT(*) as cnt FROM suppliers`);
  if (existingCount.cnt > 0) return;

  console.log("Seeding initial Nairobi Electronics Reseller dataset...");

  const s1 = 'sup_nairobi_1', s2 = 'sup_nairobi_2', s3 = 'sup_nairobi_3';
  await run(`INSERT INTO suppliers (id, name, contact_info, currency_default, reliability_score, avg_delivery_days, warranty_terms_default)
    VALUES (?, ?, ?, ?, ?, ?, ?)`, [s1, 'Global Tech Wholesalers Nairobi', 'info@globaltech.co.ke', 'USD', 9.2, 2, '2 Years Warranty']);
  await run(`INSERT INTO suppliers (id, name, contact_info, currency_default, reliability_score, avg_delivery_days, warranty_terms_default)
    VALUES (?, ?, ?, ?, ?, ?, ?)`, [s2, 'Apex Electronics Hub Kenya', 'sales@apexhub.co.ke', 'USD', 8.5, 3, '1 Year Warranty']);
  await run(`INSERT INTO suppliers (id, name, contact_info, currency_default, reliability_score, avg_delivery_days, warranty_terms_default)
    VALUES (?, ?, ?, ?, ?, ?, ?)`, [s3, 'Pacific Direct Sourcing Ltd', 'procurement@pacific.co.ke', 'KES', 7.8, 5, '1 Year Warranty']);

  const impId = 'imp_seed_1';
  await run(`INSERT INTO supplier_imports (id, supplier_id, file_name, raw_row_count) VALUES (?, ?, ?, ?)`,
    [impId, s1, 'Seed_Pricelist.xlsx', 10]);

  const seedItems = [
    // Product Group 1: Samsung 990 EVO Plus 1TB NVMe SSD
    { id: 'rl_1', sup: s1, name: 'SAMSUNG SSD 1TB NVME 990 EVO PLUS', sku: 'MZ-V9S1T0BW', price: 98.00, curr: 'USD', stock: '25 in stock', stockQty: 25 },
    { id: 'rl_2', sup: s2, name: 'Samsung 990 EVO Plus 1TB PCIe 4.0 M.2 NVMe SSD', sku: 'MZV9S1T0BW', price: 94.50, curr: 'USD', stock: 'In Stock', stockQty: 30 },
    { id: 'rl_3', sup: s3, name: 'Samsung Solid State Drive 990 EVO Plus 1TB NVMe', sku: 'SAMS-990-1TB', price: 12500.00, curr: 'KES', stock: '10 in stock', stockQty: 10 },

    // Product Group 2: Dell XPS 15 9530
    { id: 'rl_4', sup: s1, name: 'Dell XPS 15 Laptop i7 16GB 512GB SSD', sku: 'XPS15-9530-01', price: 1450.00, curr: 'USD', stock: '15', stockQty: 15 },
    { id: 'rl_5', sup: s2, name: 'Dell XPS 15 9530 Core i7-13700H 16/512GB', sku: 'XPS159530', price: 1399.99, curr: 'USD', stock: 'In Stock', stockQty: 8 },

    // Product Group 3: Apple MacBook Pro 14 M3
    { id: 'rl_6', sup: s1, name: 'Apple MacBook Pro 14 M3 8-Core 8GB 512GB Space Gray', sku: 'MRX33LL/A', price: 1599.00, curr: 'USD', stock: '8', stockQty: 8 },
    { id: 'rl_7', sup: s2, name: 'MacBook Pro 14 M3 512GB - Space Gray', sku: 'MBP14-M3-512', price: 1549.00, curr: 'USD', stock: 'In Stock', stockQty: 12 },

    // Product Group 4: Logitech MX Master 3S Mouse
    { id: 'rl_8', sup: s1, name: 'Logitech MX Master 3S Wireless Performance Mouse Black', sku: '910-006556', price: 99.99, curr: 'USD', stock: '50+', stockQty: 50 },
    { id: 'rl_9', sup: s2, name: 'Logitech MX Master 3S Mouse Graphite', sku: 'MX-3S-GRAPHITE', price: 89.95, curr: 'USD', stock: 'In Stock', stockQty: 35 }
  ];

  for (const item of seedItems) {
    await run(
      `INSERT INTO raw_listings (id, supplier_import_id, supplier_id, raw_name, raw_sku, raw_price, raw_currency, raw_stock_text, parsed_price, parsed_currency, parsed_stock_status, parsed_stock_qty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item.id, impId, item.sup, item.name, item.sku, item.price, item.curr, item.stock, item.price, item.curr, 'in_stock', item.stockQty || 0]
    );
    await processListing(item.id);
  }

  // Seed historical price observations (simulate 30 days of price history)
  console.log("Seeding historical price observations...");
  const priceVariations = [
    { productSearch: 'SAMSUNG', sup: s1, basePrice: 98, curr: 'USD', rate: 129.50, days: [30, 23, 16, 10, 7, 3, 1] },
    { productSearch: 'SAMSUNG', sup: s2, basePrice: 94.50, curr: 'USD', rate: 129.50, days: [28, 21, 14, 7, 3] },
    { productSearch: 'Dell XPS', sup: s1, basePrice: 1450, curr: 'USD', rate: 129.50, days: [25, 18, 10, 5] },
    { productSearch: 'MacBook', sup: s1, basePrice: 1599, curr: 'USD', rate: 129.50, days: [30, 20, 10, 3] },
    { productSearch: 'Logitech', sup: s1, basePrice: 99.99, curr: 'USD', rate: 129.50, days: [30, 22, 15, 8, 2] },
  ];

  const { getStore } = await import('./db.js');
  const store = getStore();

  for (const pv of priceVariations) {
    const product = store.canonical_products.find((p) =>
      p.canonical_name && p.canonical_name.toUpperCase().includes(pv.productSearch.toUpperCase())
    );
    if (!product) continue;

    for (const daysAgo of pv.days) {
      const variation = 1 + (Math.random() * 0.10 - 0.05); // ±5% random variation
      const historicalPrice = pv.basePrice * variation;
      const capturedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

      await priceObservationRepo.record({
        supplier_id: pv.sup,
        canonical_product_id: product.id,
        price: Math.round(historicalPrice * 100) / 100,
        currency: pv.curr,
        price_in_base_currency: Math.round(historicalPrice * pv.rate * 100) / 100,
        stock_quantity: Math.floor(Math.random() * 30) + 5,
        stock_status: 'in_stock',
        captured_at: capturedAt,
        source: 'seed_data'
      });
    }
  }

  console.log("Seeding complete.");
}

// ─── Server Startup ─────────────────────────────────────────────────────────

let server;

async function startServer() {
  // Environment validation
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    event: 'startup',
    port: PORT,
    nodeEnv: process.env.NODE_ENV || 'development'
  }));

  await initDb();
  await seedDefaultDataset();

  server = app.listen(PORT, () => {
    console.log(`Supplier Intelligence Engine v3.0 running at http://localhost:${PORT}`);
    console.log(`  API:        http://localhost:${PORT}/api`);
    console.log(`  Health:     http://localhost:${PORT}/api/health`);
    console.log(`  Storefront: http://localhost:${PORT}/api/storefront/products`);
  });
}

// ─── Graceful Shutdown ──────────────────────────────────────────────────────

function gracefulShutdown(signal) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event: 'shutdown', signal }));

  if (server) {
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });

    // Force exit after 10s if connections don't close
    setTimeout(() => {
      console.error('Forced shutdown after timeout.');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();
