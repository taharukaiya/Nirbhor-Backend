/**
 * Job Model
 * 
 * Architectural Intent & Business Logic:
 * Represents the core entity of the platform: a task posted by a Hirer.
 * 
 * Lifecycle (Status):
 * 1. OPEN: Job is posted, accepting Proposals.
 * 2. PAYMENT_PENDING: Hirer accepted a proposal, waiting for Escrow deposit via payment gateway.
 * 3. IN_PROGRESS: Escrow funded. Provider is working.
 * 4. COMPLETED: Hirer confirmed work. Escrow released to Provider (minus commission).
 * 5. CANCELLED: Terminated before completion.
 * 6. DISPUTED: Frozen by a Dispute. Awaiting Admin arbitration.
 */
import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    hirer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Duplicate of `hirer` used in some legacy aggregation pipelines.
    hirerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      index: true,
    },
    serviceType: { type: String, trim: true, maxlength: 80 },
    location: {
      division: { type: String, required: true, trim: true, index: true },
      district: { type: String, required: true, trim: true, index: true },
      thana: { type: String, required: true, trim: true },
      road: { type: String, default: "" },
      address: { type: String, required: true, trim: true, maxlength: 300 },
      city: { type: String, trim: true, maxlength: 80 },
    },
    budget: {
      min: { type: Number, required: true, min: 0 },
      max: { type: Number, required: true, min: 0 },
      type: { type: String, enum: ["FIXED", "HOURLY"], default: "FIXED" },
    },
    payRate: { type: Number, min: 0, default: 0 },
    skills: [{ type: String, trim: true, maxlength: 50 }],
    deadline: { type: Date, default: null },
    status: {
      type: String,
      enum: [
        "OPEN",
        "PAYMENT_PENDING",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
        "DISPUTED",
      ],
      default: "OPEN",
      index: true,
    },
    // Link to the winning bid. Null until a proposal is accepted.
    acceptedProposal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      default: null,
    },
  },
  { timestamps: true },
);

// Compound index for the primary job feed filter queries (Status + Location + Category)
jobSchema.index({
  status: 1,
  "location.district": 1,
  category: 1,
  createdAt: -1,
});

// Text index for keyword searching in the job feed
jobSchema.index({ title: "text", description: "text", skills: "text" });

// Pre-validation hook to ensure business logic constraints
jobSchema.pre("validate", function validateBudget(next) {
  if (this.budget?.max < this.budget?.min)
    this.invalidate(
      "budget.max",
      "Maximum budget must be at least minimum budget",
    );
  next();
});

export const Job = mongoose.model("Job", jobSchema);
