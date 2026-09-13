import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { listCategories } from "../controllers/adminController.js";

const router = Router();

// Publicly accessible category route
router.get("/", asyncHandler(listCategories));

export default router;
