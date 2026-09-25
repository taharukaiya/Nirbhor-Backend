/**
 * WalletDeposit Model
 * 
 * Architectural Intent:
 * Records the intent and result of a user adding fiat money into their digital platform wallet.
 * 
 * Flow:
 * 1. User requests deposit -> Document created with status PENDING.
 * 2. User redirected to SSLCommerz.
 * 3. SSLCommerz hits the IPN Webhook -> `gatewayTransactionId` is matched.
 * 4. If payment valid, status -> COMPLETED, and `User.walletBalance` is incremented.
 */
import mongoose from "mongoose";

const walletDepositSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Amount in BDT
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    // The unique TRN identifier passed to the payment gateway (SSLCommerz)
    gatewayTransactionId: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED", "CANCELLED"],
      default: "PENDING",
    },
  },
  { timestamps: true }
);

export const WalletDeposit = mongoose.model("WalletDeposit", walletDepositSchema);
