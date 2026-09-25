/**
 * Notification Utility
 * 
 * Architectural Intent:
 * Couples database persistence (saving the notification for later retrieval) 
 * with real-time delivery (pushing it via WebSockets).
 * 
 * Flow:
 * 1. Creates a MongoDB `Notification` record.
 * 2. Immediately broadcasts the payload to `user:<id>` socket room.
 */
import { Notification } from "../models/Notification.js";
import { emitNotification } from "../sockets/chatSocket.js";

export async function createNotification({ user, type, title, message, link }) {
  try {
    const notification = await Notification.create({
      user,
      type,
      title,
      message,
      link,
    });
    
    emitNotification(user.toString(), notification);
    
    return notification;
  } catch (error) {
    console.error("Failed to create notification:", error);
    return null;
  }
}
