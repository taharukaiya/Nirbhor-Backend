export const sslcommerzConfig = {
  storeId: process.env.SSLCOMMERZ_STORE_ID,
  storePassword: process.env.SSLCOMMERZ_STORE_PASSWORD,
  isLive: process.env.SSLCOMMERZ_IS_LIVE === "true",
  baseUrl:
    process.env.SSLCOMMERZ_IS_LIVE === "true"
      ? "https://securepay.sslcommerz.com"
      : "https://sandbox.sslcommerz.com",
};
