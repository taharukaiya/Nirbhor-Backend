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
} from "../controllers/adminController.js";

const router = Router();
router.use(authenticateAdmin);
router.get("/categories", asyncHandler(listCategories));
router.post("/categories", requireAdmin, asyncHandler(createCategory));
router.patch("/users/:userId/nid", requireAdmin, asyncHandler(reviewNid));
router.patch("/users/:userId/suspend", requireAdmin, asyncHandler(suspendUser));
router.post("/admins", requireSuperAdmin, asyncHandler(createAdmin));
export default router;
