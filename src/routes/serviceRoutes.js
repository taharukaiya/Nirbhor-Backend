/**
 * Abstract Service Definition Routes
 * 
 * Architectural Intent:
 * While Jobs define specific tasks requested by a Hirer, Services allow Providers to 
 * list predefined gig offerings. These routes expose CRUD operations for those catalog 
 * items.
 */
import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { getServiceProvider, listServices } from "../controllers/serviceController.js";

const router = Router();
router.get("/", asyncHandler(listServices));
router.get("/:id", asyncHandler(getServiceProvider));

export default router;
