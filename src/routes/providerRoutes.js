import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { getProviderProposals } from "../controllers/providerController.js";

const router = Router();

router.get("/proposals", authenticate, asyncHandler(getProviderProposals));

export default router;
