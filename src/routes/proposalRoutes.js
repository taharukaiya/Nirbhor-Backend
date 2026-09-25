/**
 * Proposal Retrieval Routes
 * 
 * Architectural Intent:
 * Fetches standalone proposal details independent of the parent Job. Useful for 
 * dashboard aggregations, transaction tracking, or isolated proposal views where the 
 * parent job context is already known or not immediately necessary.
 */
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
