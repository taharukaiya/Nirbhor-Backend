/**
 * SSLCommerz Payment Gateway Configuration
 * 
 * Architectural Intent:
 * Centralizes the configuration for the SSLCommerz payment integration.
 * It dynamically toggles between the secure live production endpoint and the sandbox 
 * testing endpoint based on the `SSLCOMMERZ_IS_LIVE` environment variable.
 * This ensures that local development and staging environments never accidentally 
 * hit the production payment ledger.
 */
export const sslcommerzConfig = {
  storeId: process.env.SSLCOMMERZ_STORE_ID,
  storePassword: process.env.SSLCOMMERZ_STORE_PASSWORD,
  // Strict boolean cast from environment string to prevent accidental truthy evaluations
  isLive: process.env.SSLCOMMERZ_IS_LIVE === "true",
  baseUrl:
    process.env.SSLCOMMERZ_IS_LIVE === "true"
      ? "https://securepay.sslcommerz.com"
      : "https://sandbox.sslcommerz.com",
};
