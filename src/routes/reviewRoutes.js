import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { createReview, getUserReviews, getJobReviews } from "../controllers/reviewController.js";

const router = Router();

router.post("/jobs/:jobId", authenticate, asyncHandler(createReview));
router.get("/jobs/:jobId", authenticate, asyncHandler(getJobReviews));
router.get("/users/:userId", asyncHandler(getUserReviews));

export default router;
