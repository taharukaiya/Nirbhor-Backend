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
    name: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ["ADMIN", "SUPER_ADMIN", "SUPERADMIN"],
      required: true,
    },
    permissions: {
      canManageUsers: { type: Boolean, default: false },
      canManageJobs: { type: Boolean, default: false },
      canHandleDisputes: { type: Boolean, default: false },
      canVerifyNID: { type: Boolean, default: false },
      canPromoteAdmins: { type: Boolean, default: false }, // Only SUPER_ADMIN
      canViewAuditLogs: { type: Boolean, default: false },
      canModerateContent: { type: Boolean, default: false },
      canSuspendUsers: { type: Boolean, default: false },
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    notes: { type: String, trim: true, maxlength: 500, default: "" },
    suspended: { type: Boolean, default: false },
    refreshTokens: { type: [refreshTokenSchema], default: [] },
  },
  { timestamps: true },
);

adminSchema.index({ email: 1, role: 1 });
adminSchema.index({ suspended: 1 });

export const Admin = mongoose.model("Admin", adminSchema);
