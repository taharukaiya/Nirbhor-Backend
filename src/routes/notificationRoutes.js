import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { getNotifications, markAsRead } from "../controllers/notificationController.js";

const router = Router();

router.get("/", authenticate, asyncHandler(getNotifications));
router.patch("/:id/read", authenticate, asyncHandler(markAsRead));

export default router;
