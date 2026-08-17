import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbFilePath = path.join(__dirname, 'procurement_db.json');

let store = {
  suppliers: [],
  supplier_imports: [],
  raw_listings: [],
  canonical_products: [],
  supplier_offers: [],
  price_histories: [],
  match_suggestions: [],
  exchange_rates: [],
  users: [],
  audit_logs: []
};

function saveStore() {
  try {
    fs.writeFileSync(dbFilePath, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error("Failed to persist procurement database file:", err);
  }
}

function loadStore() {
  if (fs.existsSync(dbFilePath)) {
    try {
      const data = fs.readFileSync(dbFilePath, 'utf8');
      store = { ...store, ...JSON.parse(data) };
    } catch (err) {
      console.error("Error reading database file, starting fresh:", err);
    }
  }
}

export async function initDb() {
  loadStore();

  // Seed default Exchange Rates if empty
  if (store.exchange_rates.length === 0) {
    store.exchange_rates = [
      { id: 'fx_1', currency_code: 'KES', rate_to_base: 1.0, as_of_date: new Date().toISOString() },
      { id: 'fx_2', currency_code: 'USD', rate_to_base: 129.50, as_of_date: new Date().toISOString() },
      { id: 'fx_3', currency_code: 'EUR', rate_to_base: 140.20, as_of_date: new Date().toISOString() },
      { id: 'fx_4', currency_code: 'GBP', rate_to_base: 164.80, as_of_date: new Date().toISOString() }
    ];
  }

  // Seed initial Admin User if empty
  if (store.users.length === 0) {
    store.users = [
      { id: 'usr_1', name: 'Senior Procurement Buyer', role: 'admin', email: 'buyer@supplier-made-easy.co.ke' }
    ];
  }

  saveStore();
  console.log("Transactional Procurement Database initialized with 10 core tables.");
}

export async function query(sql, params = []) {
  const norm = sql.trim().toLowerCase();

  if (norm.includes('from canonical_products')) {
    let list = [...store.canonical_products];
    if (norm.includes('merged_into_id is null')) {
      list = list.filter((p) => !p.merged_into_id);
    }
    return list;
  }

  if (norm.includes('from suppliers')) {
    if (params.length === 1 && norm.includes('where lower(name) = lower(?)')) {
      const target = String(params[0] || "").toLowerCase();
      return store.suppliers.filter((s) => (s.name || "").toLowerCase() === target);
    }
    return [...store.suppliers];
  }

  if (norm.includes('from exchange_rates')) {
    return [...store.exchange_rates];
  }

  if (norm.includes('from match_suggestions')) {
    let list = [...store.match_suggestions];
    if (norm.includes("where m.status = 'pending'")) {
      list = list.filter((s) => s.status === 'pending');
    }
    return list.map((s) => {
      const ra = store.raw_listings.find((r) => r.id === s.raw_listing_a_id) || {};
      const rb = store.raw_listings.find((r) => r.id === s.raw_listing_b_id) || {};
      const sa = store.suppliers.find((sp) => sp.id === ra.supplier_id) || {};
      const sb = store.suppliers.find((sp) => sp.id === rb.supplier_id) || {};
      const cp = store.canonical_products.find((c) => c.id === s.canonical_product_id) || {};

      return {
        ...s,
        listing_a_name: ra.raw_name,
        listing_a_sku: ra.raw_sku,
        listing_a_price: ra.parsed_price,
        listing_a_curr: ra.parsed_currency,
        supplier_a_name: sa.name,
        listing_b_name: rb.raw_name,
        listing_b_sku: rb.raw_sku,
        listing_b_price: rb.parsed_price,
        listing_b_curr: rb.parsed_currency,
        supplier_b_name: sb.name,
        canonical_name: cp.canonical_name
      };
    });
  }

  if (norm.includes('from raw_listings')) {
    let list = [...store.raw_listings];
    if (params.length >= 1 && norm.includes('where r.canonical_product_id = ?')) {
      list = list.filter((r) => r.canonical_product_id === params[0]);
    } else if (params.length >= 2 && norm.includes('where id != ? and supplier_id != ?')) {
      list = list.filter((r) => r.id !== params[0] && r.supplier_id !== params[1] && r.canonical_product_id);
    }

    return list.map((r) => {
      const s = store.suppliers.find((sp) => sp.id === r.supplier_id) || {};
      return {
        ...r,
        supplier_name: s.name,
        currency_default: s.currency_default,
        reliability_score: s.reliability_score,
        avg_delivery_days: s.avg_delivery_days,
        warranty_terms_default: s.warranty_terms_default
      };
    });
  }

  if (norm.includes('from price_histories')) {
    let list = [...store.price_histories];
    if (params.length === 1 && norm.includes('where canonical_product_id = ?')) {
      list = list.filter((h) => h.canonical_product_id === params[0]);
    }
    return list;
  }

  if (norm.includes('from audit_logs')) {
    return [...store.audit_logs].reverse();
  }

  return [];
}

export async function get(sql, params = []) {
  const norm = sql.trim().toLowerCase();

  if (norm.includes('from suppliers')) {
    if (norm.includes('count(*)')) return { cnt: store.suppliers.length };
    if (norm.includes('where id = ?')) return store.suppliers.find((s) => s.id === params[0]);
    if (norm.includes('where lower(name) = lower(?)')) return store.suppliers.find((s) => (s.name || "").toLowerCase() === String(params[0] || "").toLowerCase());
  }

  if (norm.includes('from users')) {
    if (norm.includes('count(*)')) return { cnt: store.users.length };
  }

  if (norm.includes('from exchange_rates')) {
    if (norm.includes('count(*)')) return { cnt: store.exchange_rates.length };
    if (norm.includes('where currency_code = ?')) return store.exchange_rates.find((r) => r.currency_code === params[0]);
  }

  if (norm.includes('from raw_listings')) {
    if (norm.includes('where id = ?')) return store.raw_listings.find((r) => r.id === params[0]);
  }

  if (norm.includes('from match_suggestions')) {
    if (norm.includes('where id = ?')) return store.match_suggestions.find((s) => s.id === params[0]);
  }

  if (norm.includes('from canonical_products')) {
    if (norm.includes('where id = ?')) return store.canonical_products.find((c) => c.id === params[0]);
  }

  const results = await query(sql, params);
  return results.length ? results[0] : null;
}

export async function run(sql, params = []) {
  const norm = sql.trim().toLowerCase();

  if (norm.startsWith('insert into suppliers')) {
    const obj = {
      id: params[0],
      name: params[1],
      contact_info: params[2] || '',
      currency_default: params[3] || 'USD',
      reliability_score: params[4] !== undefined ? params[4] : 8.0,
      avg_delivery_days: params[5] !== undefined ? params[5] : 3,
      warranty_terms_default: params[6] || '1 Year Warranty',
      active: 1,
      created_at: new Date().toISOString()
    };
    store.suppliers.push(obj);
  } else if (norm.startsWith('insert into supplier_imports')) {
    store.supplier_imports.push({
      id: params[0],
      supplier_id: params[1],
      file_name: params[2],
      raw_row_count: params[3],
      uploaded_at: new Date().toISOString()
    });
  } else if (norm.startsWith('insert into raw_listings')) {
    store.raw_listings.push({
      id: params[0],
      supplier_import_id: params[1],
      supplier_id: params[2],
      raw_name: params[3],
      raw_sku: params[4],
      raw_price: params[5],
      raw_currency: params[6],
      raw_stock_text: params[7],
      parsed_price: params[8],
      parsed_currency: params[9],
      parsed_stock_status: params[10],
      canonical_product_id: null,
      match_confidence: null,
      match_status: 'unmatched',
      created_at: new Date().toISOString()
    });
  } else if (norm.startsWith('insert into canonical_products')) {
    store.canonical_products.push({
      id: params[0],
      canonical_name: params[1],
      brand: params[2] || 'Generic',
      category: params[3] || 'Electronics',
      model_number: params[4] || '',
      attributes: params[5] || '{}',
      created_at: new Date().toISOString()
    });
  } else if (norm.startsWith('insert into match_suggestions')) {
    store.match_suggestions.push({
      id: params[0],
      raw_listing_a_id: params[1],
      raw_listing_b_id: params[2],
      canonical_product_id: params[3],
      similarity_score: params[4],
      matching_signals: params[5],
      status: params[6] || 'pending',
      created_at: new Date().toISOString()
    });
  } else if (norm.startsWith('insert into exchange_rates')) {
    store.exchange_rates.push({
      id: params[0],
      currency_code: params[1],
      rate_to_base: params[2],
      as_of_date: new Date().toISOString()
    });
  } else if (norm.startsWith('insert into audit_logs')) {
    store.audit_logs.push({
      id: params[0],
      user_id: params[1] || 'sys',
      action: params[2],
      entity_type: params[3],
      entity_id: params[4],
      before: params[5] || '{}',
      after: params[6] || '{}',
      created_at: new Date().toISOString()
    });
  } else if (norm.startsWith('update raw_listings')) {
    const targetId = params[params.length - 1];
    const item = store.raw_listings.find((r) => r.id === targetId);
    if (item) {
      if (params.length >= 1) item.canonical_product_id = params[0];
      if (params.length >= 2 && typeof params[1] === 'number') item.match_confidence = params[1];
      if (norm.includes("match_status = 'confirmed'")) item.match_status = 'confirmed';
      if (norm.includes("match_status = 'suggested'")) item.match_status = 'suggested';
    } else if (norm.includes('set canonical_product_id = ? where canonical_product_id = ?')) {
      store.raw_listings.forEach((r) => {
        if (r.canonical_product_id === params[1]) r.canonical_product_id = params[0];
      });
    }
  } else if (norm.startsWith('update match_suggestions')) {
    const item = store.match_suggestions.find((s) => s.id === params[0]);
    if (item) {
      if (norm.includes("status = 'approved'")) item.status = 'approved';
      if (norm.includes("status = 'rejected'")) item.status = 'rejected';
      item.reviewed_at = new Date().toISOString();
    }
  } else if (norm.startsWith('update canonical_products')) {
    const item = store.canonical_products.find((c) => c.id === params[1]);
    if (item && norm.includes('set merged_into_id = ?')) {
      item.merged_into_id = params[0];
    }
  } else if (norm.startsWith('update exchange_rates')) {
    const item = store.exchange_rates.find((r) => r.currency_code === params[1]);
    if (item) {
      item.rate_to_base = params[0];
      item.as_of_date = new Date().toISOString();
    }
  }

  saveStore();
  return { changes: 1 };
}
