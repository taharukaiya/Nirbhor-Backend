import { Router } from "express";
import { adminLoginLimiter } from "../middleware/rateLimiters.js";
import {
  loginAdmin,
  logoutAdmin,
  refreshAdmin,
} from "../controllers/adminAuthController.js";

const router = Router();
router.post("/login", adminLoginLimiter, loginAdmin);
router.post("/refresh", refreshAdmin);
router.post("/logout", logoutAdmin);
export default router;
