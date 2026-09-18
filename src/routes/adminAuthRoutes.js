import { Router } from "express";
import { adminLoginLimiter } from "../middleware/rateLimiters.js";
import {
  getAdminSession,
  loginAdmin,
  logoutAdmin,
  refreshAdmin,
  changeAdminPassword,
} from "../controllers/adminAuthController.js";
import { authenticateAdmin } from "../middleware/auth.js";

const router = Router();
router.post("/login", adminLoginLimiter, loginAdmin);
router.get("/session", getAdminSession);
router.post("/refresh", refreshAdmin);
router.post("/logout", logoutAdmin);
router.post("/change-password", authenticateAdmin, changeAdminPassword);
export default router;
