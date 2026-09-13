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
  deleteCategory,
  listCategories,
  reviewNid,
  suspendUser,
  listUsers,
  getSystemStats,
  promoteUserToAdmin,
  listAdmins,
  revokeAdmin,
  listDisputes,
  getDisputeDetails,
  resolveDispute,
  listAuditLogs,
  getPendingVerifications,
  updateAdminPermissions,
} from "../controllers/adminController.js";

const router = Router();
router.use(authenticateAdmin);

// Dashboard & Analytics
router.get("/metrics", requireAdmin, asyncHandler(getSystemStats));
router.get("/stats", requireAdmin, asyncHandler(getSystemStats));
router.get("/audit-logs", requireSuperAdmin, asyncHandler(listAuditLogs));

// User management & NID verification queue
router.get("/users", requireAdmin, asyncHandler(listUsers));
router.get("/verifications", requireAdmin, asyncHandler(getPendingVerifications));
router.patch("/verifications/:userId", requireAdmin, asyncHandler(reviewNid));
router.patch("/users/:userId/nid", requireAdmin, asyncHandler(reviewNid));
router.patch("/users/:userId/suspend", requireAdmin, asyncHandler(suspendUser));

// Dispute resolution console
router.get("/disputes", requireAdmin, asyncHandler(listDisputes));
router.get("/disputes/:disputeId", requireAdmin, asyncHandler(getDisputeDetails));
router.post("/disputes/:disputeId/resolve", requireAdmin, asyncHandler(resolveDispute));

// Admin manager management (Super Admin only)
router.get("/managers", requireSuperAdmin, asyncHandler(listAdmins));
router.get("/admins", requireSuperAdmin, asyncHandler(listAdmins));
router.post("/managers", requireSuperAdmin, asyncHandler(createAdmin));
router.post("/admins", requireSuperAdmin, asyncHandler(createAdmin));
router.patch("/managers/:adminId/permissions", requireSuperAdmin, asyncHandler(updateAdminPermissions));
router.patch("/admins/:adminId/permissions", requireSuperAdmin, asyncHandler(updateAdminPermissions));
router.delete("/managers/:adminId", requireSuperAdmin, asyncHandler(revokeAdmin));
router.delete("/admins/:adminId", requireSuperAdmin, asyncHandler(revokeAdmin));
router.post("/users/:userId/promote", requireSuperAdmin, asyncHandler(promoteUserToAdmin));

// Categories
router.get("/categories", asyncHandler(listCategories));
router.post("/categories", requireAdmin, asyncHandler(createCategory));
router.delete("/categories/:id", requireAdmin, asyncHandler(deleteCategory));

export default router;
