/**
 * AuditLog Model
 * 
 * Architectural Intent:
 * Provides an immutable, append-only ledger of all critical administrative actions.
 * Essential for platform compliance, accountability, and tracking down rouge admin behavior.
 * 
 * Edge Cases:
 * Handles polymorphic targets (`targetType`, `targetId`) because an admin might ban a User,
 * delete a Job, or resolve a Dispute. The `details` Mixed type stores the exact JSON state 
 * diff at the time of the action.
 */
import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    // E.g., 'User', 'Job', 'Dispute', 'Admin'
    targetType: {
      type: String,
      required: true,
      trim: true,
    },
    // Kept as String to avoid strictly casting to ObjectId, in case we log actions on string-based IDs
    targetId: {
      type: String,
      trim: true,
      default: "",
    },
    // Schema.Types.Mixed allows storing arbitrary JSON (e.g., the state before and after the action)
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true },
);

// Indexed for chronological retrieval (latest first) in the Admin Dashboard
auditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
