import { Router } from "express";
import { authenticate, requireVerifiedNID } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  acceptProposal,
  createJob,
  getJob,
  listJobs,
  listProposals,
  submitProposal,
} from "../controllers/jobController.js";

const router = Router();
router.get("/", asyncHandler(listJobs));
router.get("/:jobId", asyncHandler(getJob));
router.post("/", authenticate, asyncHandler(createJob));
router.post(
  "/:jobId/proposals",
  authenticate,
  requireVerifiedNID,
  asyncHandler(submitProposal),
);
router.get("/:jobId/proposals", authenticate, asyncHandler(listProposals));
router.post(
  "/:jobId/proposals/:proposalId/accept",
  authenticate,
  requireVerifiedNID,
  asyncHandler(acceptProposal),
);
export default router;
