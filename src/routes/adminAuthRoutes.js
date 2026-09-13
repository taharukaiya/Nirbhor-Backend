import { Router } from "express";
import { adminLoginLimiter } from "../middleware/rateLimiters.js";
import {
  getAdminSession,
  loginAdmin,
  logoutAdmin,
  refreshAdmin,
} from "../controllers/adminAuthController.js";

const router = Router();
router.post("/login", adminLoginLimiter, loginAdmin);
router.get("/session", getAdminSession);
router.post("/refresh", refreshAdmin);
router.post("/logout", logoutAdmin);
export default router;
