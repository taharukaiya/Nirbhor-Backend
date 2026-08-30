import mongoose from "mongoose";

const escrowPaymentSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      unique: true,
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
    amount: { type: Number, required: true, min: 0 },
    platformFee: { type: Number, required: true, min: 0 },
    providerNetPayout: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ["BDT"], default: "BDT" },
    status: {
      type: String,
      enum: ["INITIATED", "HELD_IN_ESCROW", "RELEASED", "REFUNDED", "FAILED"],
      default: "INITIATED",
      index: true,
    },
    gatewayTransactionId: { type: String, sparse: true, index: true },
    releasedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
export const EscrowPayment = mongoose.model(
  "EscrowPayment",
  escrowPaymentSchema,
);
