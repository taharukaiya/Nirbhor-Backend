/**
 * Withdrawal Model
 * 
 * Architectural Intent:
 * Manages the payout requests from Providers who want to extract their earnings 
 * from the platform's digital wallet into their real-world bank or MFS accounts.
 * 
 * Logic:
 * Creating a PENDING withdrawal locks (deducts) the funds from the user's wallet immediately 
 * to prevent double-spending. If an Admin rejects the withdrawal, the funds are refunded.
 */
import mongoose from "mongoose";

const withdrawalSchema = new mongoose.Schema(
  {
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Amount in BDT to withdraw
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    method: {
      type: String,
      enum: ["bKash", "Nagad", "Bank Transfer"],
      required: true,
    },
    // The target account number (e.g., phone number for bKash, routing info for Bank)
    accountDetails: {
      type: String,
      required: true,
    },
    // Admin dashboard relies on this status for manual payout fulfillment
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
  },
  { timestamps: true }
);

export const Withdrawal = mongoose.model("Withdrawal", withdrawalSchema);
