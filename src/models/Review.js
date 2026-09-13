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
    role: {
      type: String,
      enum: ["HIRER_TO_PROVIDER", "PROVIDER_TO_HIRER"],
      required: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 2000, default: "" },
    tags: [{ type: String, trim: true, maxlength: 40 }],
  },
  { timestamps: true },
);

reviewSchema.index({ job: 1, reviewer: 1 }, { unique: true });
export const Review = mongoose.model("Review", reviewSchema);
