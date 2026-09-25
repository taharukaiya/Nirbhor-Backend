/**
 * Notification Controller
 * 
 * Architectural Intent:
 * Handles retrieval and read-state management of persistent notifications.
 * Works in tandem with `chatSocket.js` which handles the real-time push delivery.
 */
import { Notification } from "../models/Notification.js";


export async function getNotifications(request, response) {
  try {
    const notifications = await Notification.find({ user: request.user.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = await Notification.countDocuments({
      user: request.user.id,
      read: false,
    });

    return response.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("getNotifications error:", error);
    return response.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to fetch notifications" },
    });
  }
}

export async function markAsRead(request, response) {
  try {
    const { id } = request.params;
    
    if (id === "all") {
      await Notification.updateMany(
        { user: request.user.id, read: false },
        { read: true }
      );
    } else {
      await Notification.findOneAndUpdate(
        { _id: id, user: request.user.id },
        { read: true }
      );
    }

    return response.json({ success: true });
  } catch (error) {
    console.error("markAsRead error:", error);
    return response.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to update notification" },
    });
  }
}
