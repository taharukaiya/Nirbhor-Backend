import axios from "axios";
import { sslcommerzConfig } from "../config/sslcommerz.js";
import { config } from "../config.js";

export const PLATFORM_FEE_RATE = 0.05;

export function calculateEscrowBreakdown(amount) {
  const normalized = Number(amount);
  if (!Number.isFinite(normalized) || normalized <= 0)
    throw new Error("Payment amount must be positive");
  const platformFee = Math.round(normalized * PLATFORM_FEE_RATE * 100) / 100;
  return {
    amount: normalized,
    platformFee,
    providerNetPayout: Math.round((normalized - platformFee) * 100) / 100,
  };
}

export async function createPaymentSession({ paymentId, amount, customer }) {
  if (!sslcommerzConfig.storeId || !sslcommerzConfig.storePassword)
    throw new Error("SSLCommerz is not configured");
  const values = new URLSearchParams({
    store_id: sslcommerzConfig.storeId,
    store_passwd: sslcommerzConfig.storePassword,
    total_amount: String(amount),
    currency: "BDT",
    tran_id: paymentId,
    success_url: `${config.apiPublicUrl}/api/payments/sslcommerz/success`,
    fail_url: `${config.apiPublicUrl}/api/payments/sslcommerz/fail`,
    cancel_url: `${config.apiPublicUrl}/api/payments/sslcommerz/cancel`,
    ipn_url: `${config.apiPublicUrl}/api/payments/sslcommerz/ipn`,
    cus_name: customer.name,
    cus_email: customer.email,
    product_name: "Nirbhor marketplace job",
    product_category: "service",
  });
  const { data } = await axios.post(
    `${sslcommerzConfig.baseUrl}/gwprocess/v4/api.php`,
    values.toString(),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 10000,
    },
  );
  if (!data.GatewayPageURL)
    throw new Error("SSLCommerz did not return a payment URL");
  return data;
}

export async function validatePayment(transactionId, amount) {
  if (!sslcommerzConfig.storeId || !sslcommerzConfig.storePassword)
    throw new Error("SSLCommerz is not configured");
  const { data } = await axios.get(
    `${sslcommerzConfig.baseUrl}/validator/api/validationserverAPI.php`,
    {
      params: {
        val_id: transactionId,
        store_id: sslcommerzConfig.storeId,
        store_passwd: sslcommerzConfig.storePassword,
        format: "json",
      },
      timeout: 10000,
    },
  );
  if (data.status !== "VALID" || Number(data.amount) !== Number(amount))
    throw new Error("Invalid payment");
  return data;
}
