/**
 * Category Routes
 * 
 * Architectural Intent:
 * Exposes a public endpoint for the frontend to fetch available Job Categories.
 * Supports the dynamic population of job creation forms and search filters without 
 * requiring authentication.
 */
import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { listCategories } from "../controllers/adminController.js";

const router = Router();

// Publicly accessible category route
router.get("/", asyncHandler(listCategories));

export default router;
