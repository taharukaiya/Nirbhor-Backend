import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { createDispute, getAdminDisputes, resolveDispute } from "../controllers/disputeController.js";

const router = Router();

// User routes
router.post("/", authenticate, asyncHandler(createDispute));

// Admin routes
router.get("/admin", authenticate, asyncHandler(getAdminDisputes));
router.put("/admin/:id", authenticate, asyncHandler(resolveDispute));

export default router;
