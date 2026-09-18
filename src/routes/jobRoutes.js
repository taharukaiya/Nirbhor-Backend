import { Router } from "express";
import { authenticate, requireVerifiedNID } from "../middleware/auth.js";
import { body } from "express-validator";
import { validate } from "../middleware/validation.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  acceptProposal,
  applyToJob,
  createJob,
  deleteJob,
  getHirerJobs,
  getJob,
  getJobApplicants,
  listJobs,
  listProposals,
  submitProposal,
  rejectProposal,
  getMyApplications,
} from "../controllers/jobController.js";

const router = Router();
router.get("/", asyncHandler(listJobs));
router.get("/my-posts", authenticate, asyncHandler(getHirerJobs));
router.get("/my-applications", authenticate, asyncHandler(getMyApplications));
router.get("/my-posts/:jobId/applicants", authenticate, asyncHandler(getJobApplicants));
router.get("/:jobId", asyncHandler(getJob));
router.get("/:jobId/applicants", authenticate, asyncHandler(getJobApplicants));
router.post(
  "/",
  authenticate,
  body("budget.min").isNumeric().custom(value => {
    if (value < 0) throw new Error("Minimum budget must be at least 0");
    return true;
  }),
  body("budget.max").isNumeric().custom((value, { req }) => {
    if (value < 0) throw new Error("Maximum budget must be at least 0");
    if (value < req.body.budget?.min) {
      throw new Error("Maximum budget must be at least minimum budget");
    }
    return true;
  }),
  validate,
  asyncHandler(createJob)
);
router.delete("/:jobId", authenticate, asyncHandler(deleteJob));
router.post(
  "/:jobId/apply",
  authenticate,
  asyncHandler(applyToJob),
);
router.post(
  "/:jobId/proposals",
  authenticate,
  body("amount").isNumeric().custom(value => {
    if (value < 0) throw new Error("Amount must be at least 0");
    return true;
  }),
  validate,
  asyncHandler(submitProposal),
);
router.get("/:jobId/proposals", authenticate, asyncHandler(listProposals));
router.post(
  "/:jobId/proposals/:proposalId/accept",
  authenticate,
  requireVerifiedNID,
  asyncHandler(acceptProposal),
);
router.post(
  "/:jobId/proposals/:proposalId/reject",
  authenticate,
  requireVerifiedNID,
  asyncHandler(rejectProposal),
);
export default router;
