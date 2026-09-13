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
