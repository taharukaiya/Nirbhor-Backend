import { Router } from "express";
import { authenticate, optionalAuthenticate } from "../middleware/auth.js";
import { body } from "express-validator";
import { validate } from "../middleware/validation.js";
import { userLoginLimiter } from "../middleware/rateLimiters.js";
import {
  forgotPassword,
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
  uploadAvatar,
  changePassword,
  getPublicUser,
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
router.post("/refresh", refresh);
router.post("/logout", logout);
router.post("/logout-all", authenticate, logoutAll);
router.get("/session", optionalAuthenticate, session);
router.post("/avatar", authenticate, uploadAvatar);
router.patch(
  "/profile",
  authenticate,
  body("name").optional().isString().trim().isLength({ min: 2, max: 100 }),
  body("email").optional().isEmail(),
  body("phone").optional().matches(/^\+880\d{10}$/).withMessage("Phone number must start with +880 followed by exactly 10 digits."),
  body("hourlyRate").optional().isNumeric(),
  validate,
  updateProfile,
);
router.patch(
  "/mode",
  authenticate,
  switchMode,
);
router.post(
  "/nid",
  authenticate,
  body("nidNumber").isString().notEmpty(),
  body("dateOfBirth").isString().notEmpty(),
  validate,
  submitNid,
);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.post(
  "/change-password",
  authenticate,
  body("currentPassword").isString().notEmpty(),
  body("newPassword").isString().isLength({ min: 8 }),
  validate,
  changePassword,
);
router.get("/users/:userId/public", getPublicUser);
export default router;

