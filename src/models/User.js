import mongoose from "mongoose";

const refreshTokenSchema = new mongoose.Schema(
  {
    tokenId: { type: String, required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ["HIRER", "SERVICE_PROVIDER"], required: true },
    activeMode: {
      type: String,
      enum: ["HIRER", "SERVICE_PROVIDER"],
      default: "HIRER",
    },
    availableModes: {
      type: [{ type: String, enum: ["HIRER", "SERVICE_PROVIDER"] }],
      default: ["HIRER"],
    },
    accountType: {
      type: String,
      enum: ["USER"],
      default: "USER",
      immutable: true,
    },
    emailVerified: { type: Boolean, default: false },
    nidVerified: { type: Boolean, default: false },
    nidNumber: { type: String, trim: true, select: false },
    dateOfBirth: { type: Date, select: false },
    nidSubmittedAt: { type: Date, default: null },
    phone: { type: String, trim: true, maxlength: 32, default: "" },
    location: { type: String, trim: true, maxlength: 120, default: "" },
    avatar: { type: String, trim: true, default: "" },
    profile: {
      category: { type: String, trim: true, maxlength: 80 },
      district: { type: String, trim: true, maxlength: 80 },
      bio: { type: String, trim: true, maxlength: 2000 },
      skills: [{ type: String, trim: true, maxlength: 50 }],
      rating: { type: Number, min: 0, max: 5, default: 0 },
      reviews: { type: Number, min: 0, default: 0 },
      completedJobs: { type: Number, min: 0, default: 0 },
      hourlyRate: { type: Number, min: 0, default: 0 },
      availableNow: { type: Boolean, default: false },
    },
    suspended: { type: Boolean, default: false },
    refreshTokens: { type: [refreshTokenSchema], default: [] },
  },
  { timestamps: true },
);

userSchema.index({ nidVerified: 1, activeMode: 1 });

export const User = mongoose.model("User", userSchema);
