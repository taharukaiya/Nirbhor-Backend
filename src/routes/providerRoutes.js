/**
 * Service Provider Domain Routes
 * 
 * Architectural Intent:
 * Manages the specific profile and metric data associated with a user acting in the 
 * Service Provider role (freelancer). This scopes provider-specific logic (e.g., portfolio, 
 * skills) away from core account configurations.
 */
import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { getProviderProposals } from "../controllers/providerController.js";

const router = Router();

router.get("/proposals", authenticate, asyncHandler(getProviderProposals));

export default router;
