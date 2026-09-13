import { Router } from "express";
import { authenticate, requireVerifiedNID } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { updateProposalStatus } from "../controllers/jobController.js";

const router = Router();

router.patch(
  "/:proposalId/status",
  authenticate,
  requireVerifiedNID,
  asyncHandler(updateProposalStatus),
);

export default router;
