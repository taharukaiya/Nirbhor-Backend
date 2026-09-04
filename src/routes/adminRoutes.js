import { Router } from "express";
import {
  authenticateAdmin,
  requireAdmin,
  requireSuperAdmin,
} from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  createAdmin,
  createCategory,
  listCategories,
  reviewNid,
  suspendUser,
  listUsers,
  getSystemStats,
  promoteUserToAdmin,
  listAdmins,
  revokeAdmin,
} from "../controllers/adminController.js";

const router = Router();
router.use(authenticateAdmin);

// Dashboard
router.get("/stats", requireAdmin, asyncHandler(getSystemStats));

// User management
router.get("/users", requireAdmin, asyncHandler(listUsers));
router.patch("/users/:userId/nid", requireAdmin, asyncHandler(reviewNid));
router.patch("/users/:userId/suspend", requireAdmin, asyncHandler(suspendUser));

// Admin management (Super Admin only)
router.get("/admins", requireSuperAdmin, asyncHandler(listAdmins));
router.post("/admins", requireSuperAdmin, asyncHandler(createAdmin));
router.post(
  "/users/:userId/promote",
  requireSuperAdmin,
  asyncHandler(promoteUserToAdmin),
);
router.delete("/admins/:adminId", requireSuperAdmin, asyncHandler(revokeAdmin));

// Categories
router.get("/categories", asyncHandler(listCategories));
router.post("/categories", requireAdmin, asyncHandler(createCategory));

export default router;
