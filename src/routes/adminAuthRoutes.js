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
