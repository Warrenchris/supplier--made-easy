/**
 * Robust Price Parsing Utility
 * Normalizes currency symbols, commas, decimals, and European formatting.
 */

export function parsePriceValue(val) {
  if (val === null || val === undefined) return NaN;
  if (typeof val === "number") return isNaN(val) ? NaN : val;
  
  let str = String(val).trim();
  if (!str) return NaN;

  // Clean currency symbols and labels like 'KES', 'USD', '$', '€', '£', '/-', 'ea'
  str = str.replace(/^(USD|KES|EUR|GBP|KSH|US\$|\$|€|£)\s*/i, "")
           .replace(/\s*(\/\-|\/ea|ea|each|per unit)$/i, "")
           .trim();

  // European format check e.g. 1.250,50 or 1250,50
  if (/\d+\.\d{3},\d{2}/.test(str)) {
    str = str.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+,\d{2}$/.test(str)) {
    str = str.replace(",", ".");
  } else {
    // Standard thousands comma format e.g. 1,450.50
    str = str.replace(/,/g, "");
  }

  // Extract first floating-point number
  const match = str.match(/[-+]?[0-9]*\.?[0-9]+/);
  if (!match) return NaN;
  const num = parseFloat(match[0]);
  return isNaN(num) ? NaN : num;
}

export default parsePriceValue;
