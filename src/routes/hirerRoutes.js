import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  getHirerJobs,
  getJobApplicants,
} from "../controllers/jobController.js";

const router = Router();

// GET /api/hirer/jobs - Return all jobs created by authenticated Hirer
router.get("/jobs", authenticate, asyncHandler(getHirerJobs));

// GET /api/hirer/jobs/:jobId/applicants - Return applicants for specific job
router.get(
  "/jobs/:jobId/applicants",
  authenticate,
  asyncHandler(getJobApplicants),
);

export default router;
