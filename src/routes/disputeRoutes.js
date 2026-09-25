/**
 * Dispute Resolution Routes
 * 
 * Architectural Intent:
 * Exposes endpoints for end-users to raise a Dispute if an active Escrow contract goes wrong.
 * Integrates image uploads (evidence) seamlessly via `express-fileupload` and routes 
 * requests to the `disputeController`.
 */
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
