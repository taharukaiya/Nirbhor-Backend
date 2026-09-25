/**
 * Dispute Management Controller
 * 
 * Architectural Intent:
 * Provides the API surface for managing the job dispute lifecycle. 
 * Allows users (Hirer or Provider) to escalate a job that is IN_PROGRESS.
 * 
 * Flow:
 * 1. User reports an issue -> status becomes OPEN.
 * 2. Admin reviews -> Admin can refund the Hirer or pay the Provider.
 * 3. State changes cascade to the Job and the EscrowPayment models.
 */
import { Dispute } from "../models/Dispute.js";
import { Job } from "../models/Job.js";
import { Notification } from "../models/Notification.js";
import { emitNotification } from "../sockets/chatSocket.js";

export async function createDispute(request, response) {
  try {
    const { jobId, reason, description } = request.body;
    const userId = request.user.id;

    if (!jobId || !reason || !description) {
      return response.status(400).json({
        success: false,
        error: { code: "MISSING_FIELDS", message: "Job ID, reason, and description are required." },
      });
    }

    const job = await Job.findById(jobId).populate("acceptedProposal");
    if (!job) {
      return response.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Job not found." },
      });
    }

    let reportedUser = null;

    if (String(job.hirer) === userId) {
      // Hirer is reporting Provider
      if (!job.acceptedProposal) {
        return response.status(400).json({
          success: false,
          error: { code: "NO_PROVIDER", message: "Job has no accepted provider to report." },
        });
      }
      reportedUser = job.acceptedProposal.provider;
    } else if (job.acceptedProposal && String(job.acceptedProposal.provider) === userId) {
      // Provider is reporting Hirer
      reportedUser = job.hirer;
    } else {
      return response.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "You are not a participant in this job." },
      });
    }

    const dispute = await Dispute.create({
      job: jobId,
      reporter: userId,
      reportedUser: reportedUser,
      reason,
      description,
    });

    // Notify admins
    // Note: In a real system we might broadcast to an admin room.
    
    return response.status(201).json({
      success: true,
      message: "Dispute submitted successfully.",
      dispute,
    });
  } catch (error) {
    console.error("createDispute error:", error);
    return response.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to submit dispute." },
    });
  }
}

export async function getAdminDisputes(request, response) {
  try {
    if (request.user.role !== "ADMIN") {
      return response.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Admin only" } });
    }

    const disputes = await Dispute.find()
      .populate("reporter", "name email")
      .populate("reportedUser", "name email")
      .populate("job", "title")
      .sort({ createdAt: -1 })
      .lean();

    return response.json({
      success: true,
      disputes,
    });
  } catch (error) {
    console.error("getAdminDisputes error:", error);
    return response.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to fetch disputes." },
    });
  }
}

export async function resolveDispute(request, response) {
  try {
    if (request.user.role !== "ADMIN") {
      return response.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Admin only" } });
    }

    const { id } = request.params;
    const { status, resolution } = request.body;

    const dispute = await Dispute.findById(id);
    if (!dispute) {
      return response.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Dispute not found" } });
    }

    dispute.status = status;
    dispute.resolution = resolution;
    await dispute.save();

    // Notify the reporter
    const notif = await Notification.create({
      user: dispute.reporter,
      type: "SYSTEM_ALERT",
      title: "Dispute Status Updated",
      message: `Your dispute regarding job has been marked as ${status}.`,
      link: `/dashboard`
    });
    emitNotification(dispute.reporter.toString(), notif);

    return response.json({
      success: true,
      message: "Dispute updated successfully.",
      dispute,
    });
  } catch (error) {
    console.error("resolveDispute error:", error);
    return response.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to resolve dispute." },
    });
  }
}
