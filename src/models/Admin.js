import mongoose from "mongoose";

const refreshTokenSchema = new mongoose.Schema(
  {
    tokenId: { type: String, required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { _id: false },
);

const adminSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["ADMIN", "SUPER_ADMIN", "SUPERADMIN"],
      required: true,
    },
    suspended: { type: Boolean, default: false },
    refreshTokens: { type: [refreshTokenSchema], default: [] },
  },
  { timestamps: true },
);

export const Admin = mongoose.model("Admin", adminSchema);
