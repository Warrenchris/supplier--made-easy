import { query, run, get } from './db.js';

export async function getExchangeRates() {
  const rows = await query(`SELECT currency_code, rate_to_base, as_of_date FROM exchange_rates`);
  const rates = {};
  rows.forEach((r) => {
    rates[r.currency_code] = r.rate_to_base;
  });
  return rates;
}

export async function convertToBaseCurrency(amount, currency = 'USD') {
  if (isNaN(amount)) return 0;
  const rates = await getExchangeRates();
  const rate = rates[currency.toUpperCase()] || rates['USD'] || 129.50;
  return amount * rate;
}

export async function setExchangeRate(currencyCode, rateToBase) {
  const code = currencyCode.toUpperCase();
  const existing = await get(`SELECT id FROM exchange_rates WHERE currency_code = ?`, [code]);
  if (existing) {
    await run(`UPDATE exchange_rates SET rate_to_base = ?, as_of_date = CURRENT_TIMESTAMP WHERE currency_code = ?`, [rateToBase, code]);
  } else {
    const id = `fx_${Date.now()}`;
    await run(`INSERT INTO exchange_rates (id, currency_code, rate_to_base) VALUES (?, ?, ?)`, [id, code, rateToBase]);
  }
}
