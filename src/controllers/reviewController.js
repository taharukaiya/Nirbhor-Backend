import { Job } from "../models/Job.js";
import { Proposal } from "../models/Proposal.js";
import { User } from "../models/User.js";
import { Review } from "../models/Review.js";
import { Notification } from "../models/Notification.js";
import { emitNotification } from "../sockets/chatSocket.js";

export async function createReview(request, response) {
  try {
    const { jobId } = request.params;
    const { rating, comment, tags } = request.body;
    const userId = request.user.id;

    const numRating = Number(rating);
    if (!Number.isFinite(numRating) || numRating < 1 || numRating > 5) {
      return response.status(400).json({
        success: false,
        error: { code: "INVALID_RATING", message: "Rating must be between 1 and 5 stars." },
      });
    }

    const job = await Job.findById(jobId);
    if (!job || !["IN_PROGRESS", "COMPLETED"].includes(job.status)) {
      return response.status(400).json({
        success: false,
        error: { code: "INVALID_JOB", message: "Reviews can only be submitted for in-progress or completed jobs." },
      });
    }

    const acceptedProposal = await Proposal.findById(job.acceptedProposal);
    if (!acceptedProposal) {
      return response.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Accepted proposal not found for this job." },
      });
    }

    const isHirer = String(job.hirer) === userId;
    const isProvider = String(acceptedProposal.provider) === userId;

    if (!isHirer && !isProvider) {
      return response.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Only job participants can leave a review." },
      });
    }

    const role = isHirer ? "HIRER_TO_PROVIDER" : "PROVIDER_TO_HIRER";
    const revieweeId = isHirer ? acceptedProposal.provider : job.hirer;

    // Check duplicate review
    const existingReview = await Review.findOne({ job: jobId, reviewer: userId });
    if (existingReview) {
      return response.status(409).json({
        success: false,
        error: { code: "DUPLICATE_REVIEW", message: "You have already submitted a review for this job." },
      });
    }

    const review = await Review.create({
      job: jobId,
      reviewer: userId,
      reviewee: revieweeId,
      role,
      rating: numRating,
      comment: String(comment || "").trim(),
      tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [],
    });

    // Update reviewee rating statistics
    const userReviews = await Review.find({ reviewee: revieweeId, role });
    const totalCount = userReviews.length;
    const avgRating = userReviews.reduce((sum, r) => sum + r.rating, 0) / totalCount;
    const roundedAvg = Math.round(avgRating * 10) / 10;

    const revieweeUser = await User.findById(revieweeId);
    if (revieweeUser) {
      const profile = revieweeUser.profile || {};
      if (role === "HIRER_TO_PROVIDER") {
        profile.providerRating = roundedAvg;
        profile.providerReviews = totalCount;
        profile.rating = roundedAvg;
        profile.reviews = totalCount;
      } else {
        profile.hirerRating = roundedAvg;
        profile.hirerReviews = totalCount;
      }
      revieweeUser.profile = profile;
      await revieweeUser.save();
    }

    // Send Notification
    const reviewNotif = await Notification.create({
      user: revieweeId,
      type: "REVIEW_RECEIVED",
      title: "New Review Received",
      message: `You received a ${numRating}-star review for "${job.title}".`,
      link: `/profile`
    });
    emitNotification(revieweeId.toString(), reviewNotif);

    return response.status(201).json({
      success: true,
      message: "Review submitted successfully",
      review,
    });
  } catch (error) {
    console.error("createReview error:", error);
    return response.status(500).json({
      success: false,
      error: { code: "REVIEW_FAILED", message: "Failed to submit review." },
    });
  }
}

export async function getUserReviews(request, response) {
  try {
    const { userId } = request.params;
    const reviews = await Review.find({ reviewee: userId })
      .populate("reviewer", "name avatar role")
      .populate("job", "title category")
      .sort({ createdAt: -1 })
      .lean();

    return response.json({
      success: true,
      reviews,
    });
  } catch (error) {
    console.error("getUserReviews error:", error);
    return response.status(500).json({
      success: false,
      error: { code: "FETCH_FAILED", message: "Failed to retrieve reviews." },
    });
  }
}

export async function getJobReviews(request, response) {
  try {
    const { jobId } = request.params;
    const userId = request.user?.id;

    const reviews = await Review.find({ job: jobId })
      .populate("reviewer", "name avatar role")
      .populate("reviewee", "name avatar role")
      .sort({ createdAt: -1 })
      .lean();

    const hasReviewed = userId
      ? reviews.some((r) => String(r.reviewer?._id || r.reviewer) === userId)
      : false;

    return response.json({
      success: true,
      reviews,
      hasReviewed,
    });
  } catch (error) {
    console.error("getJobReviews error:", error);
    return response.status(500).json({
      success: false,
      error: { code: "FETCH_FAILED", message: "Failed to retrieve job reviews." },
    });
  }
}
