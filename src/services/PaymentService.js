import SSLCommerzPayment from "sslcommerz-lts";
import { sslcommerzConfig } from "../config/sslcommerz.js";
import { config } from "../config.js";
import { parseAmount } from "../utils/numberUtils.js";

export const PLATFORM_FEE_RATE = 0.05;

export function calculateEscrowBreakdown(amount) {
  const normalized = parseAmount(amount);
  if (normalized <= 0)
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

  const sslcommerz = new SSLCommerzPayment(
    sslcommerzConfig.storeId,
    sslcommerzConfig.storePassword,
    sslcommerzConfig.isLive
  );

  const paymentData = {
    total_amount: parseAmount(amount),
    currency: "BDT",
    tran_id: paymentId,
    success_url: `${config.apiPublicUrl}/api/payments/sslcommerz/success`,
    fail_url: `${config.apiPublicUrl}/api/payments/sslcommerz/fail`,
    cancel_url: `${config.apiPublicUrl}/api/payments/sslcommerz/cancel`,
    ipn_url: `${config.apiPublicUrl}/api/payments/sslcommerz/ipn`,
    shipping_method: "NO",
    product_name: "Nirbhor marketplace job",
    product_category: "service",
    product_profile: "general",
    cus_name: customer.name || "Nirbhor User",
    cus_email: customer.email || "user@example.com",
    cus_add1: customer.address || "Dhaka",
    cus_city: customer.city || "Dhaka",
    cus_postcode: "1000",
    cus_country: "Bangladesh",
    cus_phone: customer.phone || "01700000000",
  };

  const response = await sslcommerz.init(paymentData);
  if (!response?.GatewayPageURL) {
    throw new Error("SSLCommerz did not return a payment URL");
  }
  return response;
}

export async function validatePayment(transactionId, amount) {
  if (!sslcommerzConfig.storeId || !sslcommerzConfig.storePassword)
    throw new Error("SSLCommerz is not configured");

  const sslcommerz = new SSLCommerzPayment(
    sslcommerzConfig.storeId,
    sslcommerzConfig.storePassword,
    sslcommerzConfig.isLive
  );

  const validationResponse = await sslcommerz.validate({ val_id: transactionId });
  if (validationResponse.status !== "VALID" || parseAmount(validationResponse.amount) !== parseAmount(amount)) {
    throw new Error("Invalid payment");
  }
  return validationResponse;
}
