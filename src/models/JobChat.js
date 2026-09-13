import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    readAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
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
jobChatSchema.index({ participants: 1 });
jobChatSchema.index({ updatedAt: -1 });
export const JobChat = mongoose.model("JobChat", jobChatSchema);
