/**
 * Notification Model
 * 
 * Architectural Intent:
 * Persists in-app alerts for users. While Socket.io handles real-time delivery, 
 * this collection ensures that users who are offline when an event occurs 
 * (e.g., proposal accepted, payment received) will see their alerts upon their next login.
 */
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
      // Mixed casing due to legacy system migrations. Both uppercase and lowercase variants supported.
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
    // Optional deep-link URL (e.g., /jobs/123) for frontend routing upon click
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
