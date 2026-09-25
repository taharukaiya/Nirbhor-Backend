/**
 * Transaction History & Analytics Routes
 * 
 * Architectural Intent:
 * Provides endpoints for users to query their financial footprint on the platform.
 * Supports filtering for granular financial tracking, invoice generation context, 
 * and wallet history.
 */
import { Router } from "express";
import { authenticate, authenticateAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  getUserTransactions,
  getAdminTransactions,
  getAdminAnalytics,
} from "../controllers/transactionController.js";

const router = Router();

// User routes
router.get(
  "/my-transactions",
  authenticate,
  asyncHandler(getUserTransactions),
);

// Admin routes
router.get(
  "/admin/all",
  authenticateAdmin,
  asyncHandler(getAdminTransactions),
);

router.get(
  "/admin/analytics",
  authenticateAdmin,
  asyncHandler(getAdminAnalytics),
);

export default router;
