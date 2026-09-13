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
proposalSchema.index({ job: 1, provider: 1 }, { unique: true });
export const Proposal = mongoose.model("Proposal", proposalSchema);
