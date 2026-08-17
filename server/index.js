import express from 'express';
import cors from 'cors';
import { initDb, get, run } from './db.js';
import apiRouter from './api.js';
import { processListingMatching } from './matchingEngine.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api', apiRouter);

async function seedDefaultDataset() {
  const existingCount = await get(`SELECT COUNT(*) as cnt FROM suppliers`);
  if (existingCount.cnt > 0) return;

  console.log("Seeding initial Nairobi Electronics Reseller dataset...");

  const s1 = 'sup_nairobi_1', s2 = 'sup_nairobi_2', s3 = 'sup_nairobi_3';
  await run(`INSERT INTO suppliers (id, name, currency_default, reliability_score, avg_delivery_days, warranty_terms_default) VALUES
    ('${s1}', 'Global Tech Wholesalers Nairobi', 'USD', 9.2, 2, '2 Years Warranty'),
    ('${s2}', 'Apex Electronics Hub Kenya', 'USD', 8.5, 3, '1 Year Warranty'),
    ('${s3}', 'Pacific Direct Sourcing Ltd', 'KES', 7.8, 5, '1 Year Warranty')`);

  const impId = 'imp_seed_1';
  await run(`INSERT INTO supplier_imports (id, supplier_id, file_name, raw_row_count) VALUES ('${impId}', '${s1}', 'Seed_Pricelist.xlsx', 10)`);

  const seedItems = [
    // Product Group 1: Samsung 990 EVO Plus 1TB NVMe SSD
    { id: 'rl_1', sup: s1, name: 'SAMSUNG SSD 1TB NVME 990 EVO PLUS', sku: 'MZ-V9S1T0BW', price: 98.00, curr: 'USD', stock: '25 in stock' },
    { id: 'rl_2', sup: s2, name: 'Samsung 990 EVO Plus 1TB PCIe 4.0 M.2 NVMe SSD', sku: 'MZV9S1T0BW', price: 94.50, curr: 'USD', stock: 'In Stock' },
    { id: 'rl_3', sup: s3, name: 'Samsung Solid State Drive 990 EVO Plus 1TB NVMe', sku: 'SAMS-990-1TB', price: 12500.00, curr: 'KES', stock: '10 in stock' },

    // Product Group 2: Dell XPS 15 9530
    { id: 'rl_4', sup: s1, name: 'Dell XPS 15 Laptop i7 16GB 512GB SSD', sku: 'XPS15-9530-01', price: 1450.00, curr: 'USD', stock: '15' },
    { id: 'rl_5', sup: s2, name: 'Dell XPS 15 9530 Core i7-13700H 16/512GB', sku: 'XPS159530', price: 1399.99, curr: 'USD', stock: 'In Stock' },

    // Product Group 3: Apple MacBook Pro 14 M3
    { id: 'rl_6', sup: s1, name: 'Apple MacBook Pro 14 M3 8-Core 8GB 512GB Space Gray', sku: 'MRX33LL/A', price: 1599.00, curr: 'USD', stock: '8' },
    { id: 'rl_7', sup: s2, name: "MacBook Pro 14 M3 512GB - Space Gray", sku: 'MBP14-M3-512', price: 1549.00, curr: 'USD', stock: 'In Stock' },

    // Product Group 4: Logitech MX Master 3S Mouse
    { id: 'rl_8', sup: s1, name: 'Logitech MX Master 3S Wireless Performance Mouse Black', sku: '910-006556', price: 99.99, curr: 'USD', stock: '50+' },
    { id: 'rl_9', sup: s2, name: 'Logitech MX Master 3S Mouse Graphite', sku: 'MX-3S-GRAPHITE', price: 89.95, curr: 'USD', stock: 'In Stock' }
  ];

  for (const item of seedItems) {
    await run(
      `INSERT INTO raw_listings (id, supplier_import_id, supplier_id, raw_name, raw_sku, raw_price, raw_currency, raw_stock_text, parsed_price, parsed_currency, parsed_stock_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item.id, impId, item.sup, item.name, item.sku, item.price, item.curr, item.stock, item.price, item.curr, 'in_stock']
    );
    await processListingMatching(item.id);
  }

  console.log("Seeding complete.");
}

async function startServer() {
  await initDb();
  await seedDefaultDataset();
  app.listen(PORT, () => {
    console.log(`Supplier Intelligence REST API running at http://localhost:${PORT}/api`);
  });
}

startServer();
