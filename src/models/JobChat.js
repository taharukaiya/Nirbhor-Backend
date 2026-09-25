/**
 * JobChat Model
 * 
 * Architectural Intent:
 * Persists real-time communication between Hirers and Providers.
 * 
 * Performance Design:
 * Uses the Bucket Pattern (embedding an array of `messages` within a `JobChat` document) 
 * instead of a separate document for every single message. This optimizes read performance 
 * (fetching a chat thread is a single document read).
 * A hard limit of 5000 messages per document is enforced to prevent MongoDB BSON size limits (16MB).
 */
import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: { type: String, enum: ["TEXT", "AUDIO"], default: "TEXT" },
    body: { type: String, trim: true, maxlength: 2000 },
    audioUrl: { type: String }, // Used if type === "AUDIO"
    readAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }, // Explicitly generate _id for individual messages to allow reporting/deleting
);

const jobChatSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: false,
      index: true,
    },
    proposal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      required: false,
      index: true,
    },
    participants: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ],
    // The bucket array. Hard cap at 5000 messages to prevent BSON overflow.
    messages: {
      type: [messageSchema],
      default: [],
      validate: {
        validator: (messages) => messages.length <= 5000,
        message: "Chat message limit reached",
      },
    },
    isArchived: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

// Optimize query for finding all chats a specific user is participating in
jobChatSchema.index({ participants: 1 });
// Optimize sorting the user's chat inbox by most recent activity
jobChatSchema.index({ updatedAt: -1 });

export const JobChat = mongoose.model("JobChat", jobChatSchema);
