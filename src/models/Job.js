import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    hirer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
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
      district: { type: String, required: true, trim: true, index: true },
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
    acceptedProposal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      default: null,
    },
  },
  { timestamps: true },
);

jobSchema.index({
  status: 1,
  "location.district": 1,
  category: 1,
  createdAt: -1,
});
jobSchema.index({ title: "text", description: "text", skills: "text" });
jobSchema.pre("validate", function validateBudget(next) {
  if (this.budget?.max < this.budget?.min)
    this.invalidate(
      "budget.max",
      "Maximum budget must be at least minimum budget",
    );
  next();
});

export const Job = mongoose.model("Job", jobSchema);
