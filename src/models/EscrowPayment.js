/**
 * EscrowPayment Model
 * 
 * Architectural Intent & Business Logic:
 * Acts as the financial bridge between Hirer and Provider, ensuring trust on the platform.
 * When a Hirer accepts a Proposal, funds are deducted from their Wallet and held in this Escrow ledger.
 * 
 * Commission Pipeline:
 * Total Amount = Hirer's locked funds.
 * Platform Fee = Configured % deduction (e.g., 5%).
 * Provider Net Payout = Amount - Platform Fee.
 * 
 * Funds are ONLY released to the Provider's Wallet when the Job status changes to COMPLETED.
 */
import mongoose from "mongoose";

const escrowPaymentSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      unique: true, // One escrow contract per job
      index: true,
    },
    proposal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      required: true,
    },
    hirer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // The gross amount deducted from Hirer
    amount: { type: Number, required: true, min: 0 },
    // Platform revenue generated from this transaction
    platformFee: { type: Number, required: true, min: 0 },
    // The exact amount the Provider will receive upon release
    providerNetPayout: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ["BDT"], default: "BDT" },
    status: {
      type: String,
      enum: ["INITIATED", "HELD_IN_ESCROW", "RELEASED", "REFUNDED", "FAILED"],
      default: "INITIATED",
      index: true,
    },
    // Identifier used for reconciling with external payment gateways if direct deposit was used
    gatewayTransactionId: { type: String, sparse: true, index: true },
    releasedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const EscrowPayment = mongoose.model(
  "EscrowPayment",
  escrowPaymentSchema,
);
