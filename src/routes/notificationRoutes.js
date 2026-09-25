/**
 * Notification Routes
 * 
 * Architectural Intent:
 * Provides CRUD and read-state endpoints for user-facing system notifications.
 * Acts as the persistence layer complement to real-time notification sockets.
 */
import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { getNotifications, markAsRead } from "../controllers/notificationController.js";

const router = Router();

router.get("/", authenticate, asyncHandler(getNotifications));
router.patch("/:id/read", authenticate, asyncHandler(markAsRead));

export default router;
