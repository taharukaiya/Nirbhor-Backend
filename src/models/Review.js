/**
 * Review Model
 * 
 * Architectural Intent:
 * Enables the dual-rating reputation system. 
 * Hirers review Providers (which impacts the provider's ranking in search results), 
 * and Providers review Hirers (which helps other providers avoid toxic clients).
 * 
 * Constraints:
 * 1. A review can only be submitted after a Job is COMPLETED.
 * 2. A user can only submit one review per job (enforced via unique compound index).
 */
import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true,
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reviewee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Distinguishes the direction of the feedback
    role: {
      type: String,
      enum: ["HIRER_TO_PROVIDER", "PROVIDER_TO_HIRER"],
      required: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 2000, default: "" },
    // Tags for quick insights (e.g., "On Time", "Poor Communication")
    tags: [{ type: String, trim: true, maxlength: 40 }],
  },
  { timestamps: true },
);

// Prevent a user from leaving multiple reviews for the same job interaction
reviewSchema.index({ job: 1, reviewer: 1 }, { unique: true });

export const Review = mongoose.model("Review", reviewSchema);
