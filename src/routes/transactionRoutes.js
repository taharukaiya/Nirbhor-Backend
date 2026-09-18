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
