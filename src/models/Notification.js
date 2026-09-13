import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["NEW_PROPOSAL", "PROPOSAL_ACCEPTED", "PROPOSAL_REJECTED", "NEW_MESSAGE", "JOB_COMPLETED", "GENERAL", "proposal_accepted", "proposal_cancelled", "new_review", "payment_received", "system_alert"],
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    link: {
      type: String,
      default: null,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const Notification = mongoose.model("Notification", notificationSchema);
