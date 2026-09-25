/**
 * Dispute Model
 * 
 * Architectural Intent:
 * Acts as the official record when a Hirer or Provider raises an issue regarding a job.
 * Escrow payments are locked and cannot be released while a Dispute linked to a job is OPEN or INVESTIGATING.
 * Only Admins with `canHandleDisputes` permission can mutate the status to RESOLVED.
 */
import mongoose from "mongoose";

const disputeSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reportedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    // State machine for arbitration lifecycle
    status: {
      type: String,
      enum: ["OPEN", "INVESTIGATING", "RESOLVED", "CLOSED"],
      default: "OPEN",
    },
    // The final verdict written by the Admin arbitrator
    resolution: {
      type: String,
      trim: true,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
  }
);

export const Dispute = mongoose.model("Dispute", disputeSchema);
