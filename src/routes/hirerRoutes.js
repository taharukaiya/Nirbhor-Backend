/**
 * Hirer Domain Routes
 * 
 * Architectural Intent:
 * Segregates Hirer-specific profiles and configurations from the main user endpoints.
 * This ensures that when a dual-mode User (who can be both Hirer and Provider) acts 
 * in the context of hiring, their specific details are appropriately scoped and isolated.
 */
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
