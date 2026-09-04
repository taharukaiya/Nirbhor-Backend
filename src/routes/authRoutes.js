import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { body } from "express-validator";
import { validate } from "../middleware/validation.js";
import { userLoginLimiter } from "../middleware/rateLimiters.js";
import {
  forgotPassword,
  googleOAuth,
  login,
  logout,
  logoutAll,
  refresh,
  register,
  resetPassword,
  session,
  verifyEmail,
  switchMode,
  submitNid,
  updateProfile,
} from "../controllers/authController.js";

const router = Router();
router.post(
  "/register",
  body("name").isString().trim().isLength({ min: 2, max: 100 }),
  body("email").isEmail(),
  body("password").isLength({ min: 8 }),
  body("role").optional().isString(),
  validate,
  register,
);
router.get("/verify-email/:token", verifyEmail);
router.post("/login", userLoginLimiter, login);
router.post("/google", userLoginLimiter, googleOAuth);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.post("/logout-all", authenticate, logoutAll);
router.get("/session", authenticate, session);
router.patch(
  "/profile",
  authenticate,
  body("name").optional().isString().trim().isLength({ min: 2, max: 100 }),
  body("email").optional().isEmail(),
  body("password").optional().isLength({ min: 8 }),
  body("hourlyRate").optional().isNumeric(),
  validate,
  updateProfile,
);
router.patch(
  "/mode",
  authenticate,
  body("mode").isIn(["HIRER", "SERVICE_PROVIDER"]),
  validate,
  switchMode,
);
router.post(
  "/nid",
  authenticate,
  body("nidNumber").isString().notEmpty(),
  body("dateOfBirth").isISO8601(),
  validate,
  submitNid,
);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
export default router;
