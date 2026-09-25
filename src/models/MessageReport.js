/**
 * MessageReport Model
 * 
 * Architectural Intent:
 * Enables Trust & Safety features by allowing users to flag abusive, spammy, or 
 * inappropriate direct messages.
 * 
 * Data Preservation:
 * Includes a `snapshotContent` field which copies the exact message text at the time 
 * of the report. This prevents the abusive user from editing/deleting the message 
 * to hide evidence before an admin reviews it.
 */
import mongoose from "mongoose";

const messageReportSchema = new mongoose.Schema(
  {
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: "JobChat", required: true, index: true },
    messageId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reportedUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reason: {
      type: String,
      required: true,
      enum: ["harassment", "inappropriate_language", "attempted_circumvention", "scam", "spam", "other"],
    },
    // Immutable copy of the abusive text for admin verification
    snapshotContent: { type: String, required: true, maxlength: 2000 },
    // Moderation state machine
    status: { type: String, enum: ["pending", "reviewed", "actioned", "dismissed"], default: "pending", index: true },
    adminNote: { type: String, maxlength: 1000, default: "" },
  },
  { timestamps: true },
);

// Prevent a user from spam-reporting the exact same message multiple times
messageReportSchema.index({ chatId: 1, messageId: 1, reporterId: 1 }, { unique: true });

export const MessageReport = mongoose.model("MessageReport", messageReportSchema);

