/**
 * Review & Rating Routes
 * 
 * Architectural Intent:
 * Handles the creation and retrieval of feedback between users. Reviews form the backbone 
 * of the platform's trust mechanism and compute aggregated rating scores attached to 
 * Service Providers and Hirers.
 */
import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { createReview, getUserReviews, getJobReviews, updateReview } from "../controllers/reviewController.js";

const router = Router();

router.post("/jobs/:jobId", authenticate, asyncHandler(createReview));
router.put("/jobs/:jobId", authenticate, asyncHandler(updateReview));
router.get("/jobs/:jobId", authenticate, asyncHandler(getJobReviews));
router.get("/users/:userId", asyncHandler(getUserReviews));

export default router;
