/**
 * User Model
 * 
 * Architectural Intent:
 * The central entity for all non-administrative users. Supports a "dual-mode" architecture 
 * where a single account can operate as both a Hirer and a Service Provider without creating 
 * separate accounts. 
 * 
 * Security:
 * - `passwordHash`, `nidNumber`, and `dateOfBirth` use `select: false` to ensure they are never 
 *   accidentally leaked in standard JSON API responses.
 * - Uses nested schemas for Profile and Location to keep the root document clean.
 */
import mongoose from "mongoose";

// Subdocument schema for JWT refresh tokens to allow multi-device session management
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
      match: [/^\S+@\S+\.\S+$/, "Please use a valid email address"],
    },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    // Legacy role tracking
    role: { type: String, enum: ["HIRER", "SERVICE_PROVIDER"], required: true },
    // Tracks the current UI view the user is looking at (Hirer dashboard vs Provider dashboard)
    activeMode: {
      type: String,
      enum: ["HIRER", "SERVICE_PROVIDER"],
      default: "HIRER",
    },
    availableModes: {
      type: [{ type: String, enum: ["HIRER", "SERVICE_PROVIDER"] }],
      default: ["HIRER", "SERVICE_PROVIDER"],
    },
    // Hardcoded to prevent privilege escalation to Admin via mass assignment
    accountType: {
      type: String,
      enum: ["USER"],
      default: "USER",
      immutable: true,
    },
    emailVerified: { type: Boolean, default: false },
    // KYC Flag: Must be true before a Provider can accept jobs
    nidVerified: { type: Boolean, default: false },
    nidNumber: {
      type: String,
      trim: true,
      select: false,
      unique: true,
      sparse: true,
    },
    dateOfBirth: { type: Date, select: false },
    nidSubmittedAt: { type: Date, default: null },
    phone: { 
      type: String, 
      trim: true, 
      default: "",
      validate: {
        validator: function(v) {
          return v === "" || /^\+880\d{10}$/.test(v);
        },
        message: props => `${props.value} is not a valid phone number. It must start with +880 and contain 10 subsequent digits.`
      }
    },
    location: {
      division: { type: String, default: "" },
      district: { type: String, default: "" },
      thana: { type: String, default: "" },
      road: { type: String, default: "" },
      fullAddress: { type: String, default: "" },
    },
    avatar: { type: String, trim: true, default: "" },
    // The public-facing portfolio/stats for the user
    profile: {
      category: { type: String, trim: true, maxlength: 80 },
      district: { type: String, trim: true, maxlength: 80 },
      bio: { type: String, trim: true, maxlength: 2000 },
      skills: [{ type: String, trim: true, maxlength: 50 }],
      // Pre-calculated aggregates to prevent expensive JOINs on every profile view
      rating: { type: Number, min: 0, max: 5, default: 0 },
      reviews: { type: Number, min: 0, default: 0 },
      hirerRating: { type: Number, min: 0, max: 5, default: 0 },
      hirerReviews: { type: Number, min: 0, default: 0 },
      providerRating: { type: Number, min: 0, max: 5, default: 0 },
      providerReviews: { type: Number, min: 0, default: 0 },
      completedJobs: { type: Number, min: 0, default: 0 },
      hourlyRate: { type: Number, min: 0, default: 0 },
      availableNow: { type: Boolean, default: false },
      workingHours: { type: String, trim: true, maxlength: 100, default: "Flexible" },
      isPublished: { type: Boolean, default: false },
    },
    suspended: { type: Boolean, default: false },
    // The user's internal digital fiat balance
    walletBalance: { type: Number, default: 0, min: 0 },
    // Active sessions for the user
    refreshTokens: { type: [refreshTokenSchema], default: [] },
  },
  { timestamps: true },
);

// Index to quickly find verified providers
userSchema.index({ nidVerified: 1, activeMode: 1 });

export const User = mongoose.model("User", userSchema);
