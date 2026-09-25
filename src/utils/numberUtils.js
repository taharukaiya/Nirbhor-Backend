/**
 * Number Utility
 * 
 * Architectural Intent:
 * A defensive parsing function to ensure fiat money values (BDT) coming from 
 * client payloads or external gateways (SSLCommerz) are safely coerced into Numbers.
 * Mitigates edge cases where commas or unexpected string types break math operations.
 */
export function parseAmount(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return isNaN(value) ? 0 : value;
  
  // Remove all non-numeric characters except the decimal point
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  const parsed = Number(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}
