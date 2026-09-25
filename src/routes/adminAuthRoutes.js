/**
 * Admin Authentication Routes
 * 
 * Architectural Intent:
 * Dedicated authentication endpoints strictly for the back-office Admin panel.
 * Isolated from the standard end-user `authRoutes.js` to ensure logical segregation 
 * of privileged access workflows and separate token management.
 */
import { Router } from "express";
import { adminLoginLimiter } from "../middleware/rateLimiters.js";
import {
  getAdminSession,
  loginAdmin,
  logoutAdmin,
  refreshAdmin,
  changeAdminPassword,
  forgotPasswordAdmin,
  resetPasswordAdmin,
} from "../controllers/adminAuthController.js";
import { authenticateAdmin } from "../middleware/auth.js";

const router = Router();
router.post("/login", adminLoginLimiter, loginAdmin);
router.get("/session", getAdminSession);
router.post("/refresh", refreshAdmin);
router.post("/logout", logoutAdmin);
router.post("/change-password", authenticateAdmin, changeAdminPassword);
router.post("/forgot-password", forgotPasswordAdmin);
router.post("/reset-password/:token", resetPasswordAdmin);
export default router;
