/**
 * Proposal Model
 * 
 * Architectural Intent:
 * Represents a bid placed by a Service Provider on a Job posted by a Hirer.
 * 
 * Rules:
 * A provider can only submit ONE proposal per job (enforced by the compound unique index).
 * When a Hirer accepts a proposal, the job's `acceptedProposal` field is updated, 
 * the Hirer pays the `amount` into Escrow, and all other proposals on the job 
 * should logically be considered REJECTED.
 */
import mongoose from "mongoose";

const proposalSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
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
    message: { type: String, required: true, trim: true, maxlength: 3000 },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
  },
  { timestamps: true },
);

// One provider cannot spam a job with multiple bids
proposalSchema.index({ job: 1, provider: 1 }, { unique: true });

export const Proposal = mongoose.model("Proposal", proposalSchema);
