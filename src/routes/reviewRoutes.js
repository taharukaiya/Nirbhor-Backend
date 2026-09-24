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
