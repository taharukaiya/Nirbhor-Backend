/**
 * Job & Proposal Lifecycle Controller
 * 
 * Architectural Intent:
 * Core orchestrator for the marketplace. Manages the transition of a Job from 
 * OPEN -> PAYMENT_PENDING -> IN_PROGRESS -> COMPLETED, alongside the associated 
 * Proposals (PENDING -> ACCEPTED / REJECTED -> IN_PROGRESS -> COMPLETED).
 * 
 * Features:
 * - Dynamic aggregation of applicant counts.
 * - Enforces minimum budget logic to maintain marketplace quality.
 * - Atomic state transitions using MongoDB sessions when accepting proposals.
 */
import mongoose from "mongoose";
import { Job } from "../models/Job.js";
import { Proposal } from "../models/Proposal.js";
import { JobChat } from "../models/JobChat.js";
import { User } from "../models/User.js";
import { Notification } from "../models/Notification.js";
import { Review } from "../models/Review.js";
import { emitNotification } from "../sockets/chatSocket.js";
import { parseAmount } from "../utils/numberUtils.js";

const toJobShape = (job, hirer = null) => ({
  id: job._id.toString(),
  title: job.title,
  description: job.description,
  category: job.category || job.serviceType || "General",
  serviceType: job.serviceType || job.category || "General",
  location: job.location?.district || "Bangladesh",
  district: job.location?.district || "",
  address: job.location?.address || "",
  budget: {
    min: Number(job.budget?.min || 0),
    max: Number(job.budget?.max || 0),
    type: job.budget?.type || "FIXED",
  },
  status: String(job.status || "OPEN").toLowerCase(),
  postedAt: job.createdAt,
  deadline: job.deadline || null,
  skills: Array.isArray(job.skills) ? job.skills : [],
  hirer: {
    id: hirer?._id?.toString() || job.hirer?.toString() || "",
    name: hirer?.name || "Hirer",
    initials: (hirer?.name || "Hirer")
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    verified: !!hirer?.nidVerified,
  },
  proposals: 0,
  featured: false,
});

export async function listJobs(request, response) {
  const query = {};
  if (request.query.status)
    query.status = String(request.query.status).toUpperCase();
  if (!request.query.status) query.status = "OPEN";
  if (request.query.category || request.query.serviceType) {
    query.category = String(
      request.query.category || request.query.serviceType,
    ).trim();
  }
  if (request.query.district)
    query["location.district"] = request.query.district;
  if (request.query.q) query.$text = { $search: request.query.q };

  const jobs = await Job.find(query).sort({ createdAt: -1 }).limit(100).lean();
  const jobIds = jobs.map((j) => j._id);

  // Dynamic proposal counts per job
  const proposalCounts = await Proposal.aggregate([
    { $match: { job: { $in: jobIds } } },
    { $group: { _id: "$job", count: { $sum: 1 } } },
  ]);
  const proposalMap = new Map(
    proposalCounts.map((item) => [item._id.toString(), item.count]),
  );

  const hirerIds = [...new Set(jobs.map((job) => String(job.hirer)))];
  const hirers = await User.find({ _id: { $in: hirerIds } })
    .select("name nidVerified")
    .lean();
  const hirerMap = new Map(hirers.map((hirer) => [String(hirer._id), hirer]));

  response.json({
    jobs: jobs.map((job) => {
      const shaped = toJobShape(job, hirerMap.get(String(job.hirer)));
      shaped.proposals = proposalMap.get(job._id.toString()) || 0;
      return shaped;
    }),
  });
}

export async function createJob(request, response) {
  if (!request.user) {
    return response.status(401).json({ error: "Unauthorized" });
  }

  // Dual-role architecture: Any authenticated user can post a job.
  // Switch or ensure activeMode is HIRER for posting a job.
  if (request.user.activeMode !== "HIRER") {
    request.user.activeMode = "HIRER";
    if (!Array.isArray(request.user.availableModes)) {
      request.user.availableModes = ["HIRER", "SERVICE_PROVIDER"];
    } else if (!request.user.availableModes.includes("HIRER")) {
      request.user.availableModes.push("HIRER");
    }
    await request.user.save().catch(() => {});
  }

  const {
    title,
    description,
    category,
    serviceType,
    budget,
    location,
    skills,
    deadline,
    payRate,
  } = request.body;

  if (
    !title ||
    !description ||
    !category ||
    !location?.district ||
    !location?.division ||
    !location?.thana
  )
    return response.status(400).json({
      error:
        "Title, description, category, division, district, and thana are required",
    });

  const budgetValue =
    budget && typeof budget === "object"
      ? budget
      : {
          min: Number(request.body.budgetMin || 0),
          max: Number(request.body.budgetMax || 0),
          type: String(request.body.budgetType || "FIXED").toUpperCase(),
        };

  // Enforce minimum budget of BDT 300
  const budgetMin = Number(budgetValue.min || 0);
  if (!Number.isFinite(budgetMin) || budgetMin < 300) {
    return response.status(400).json({
      success: false,
      error: { code: "BUDGET_TOO_LOW", message: "Minimum budget must be at least ৳300." },
    });
  }

  const job = await Job.create({
    hirer: request.user.id,
    hirerId: request.user.id,
    title: String(title).trim(),
    description: String(description).trim(),
    category: String(category).trim(),
    serviceType: String(serviceType || category).trim(),
    budget: {
      min: Number(budgetValue.min || 0),
      max: Number(budgetValue.max || 0),
      type: ["FIXED", "HOURLY"].includes(
        String(budgetValue.type || "FIXED").toUpperCase(),
      )
        ? String(budgetValue.type).toUpperCase()
        : "FIXED",
    },
    payRate: Number(payRate || budgetValue.max || 0),
    location: {
      division: String(location.division || "").trim(),
      district: String(location.district || "").trim(),
      thana: String(location.thana || "").trim(),
      road: String(location.road || "").trim(),
      address: String(
        location.address ||
          location.road ||
          location.thana ||
          location.district ||
          "",
      ).trim(),
      city: String(location.city || location.district || "").trim(),
    },
    skills: Array.isArray(skills)
      ? skills.map((skill) => String(skill).trim()).filter(Boolean)
      : [],
    deadline: deadline ? new Date(deadline) : null,
    status: "OPEN",
  });

  response.status(201).json({ job: toJobShape(job, request.user) });
}

export async function getJob(request, response) {
  const job = await Job.findById(request.params.jobId).lean();
  if (!job) return response.status(404).json({ error: "Job not found" });
  const hirer = await User.findById(job.hirer)
    .select("name nidVerified")
    .lean();
  const proposalCount = await Proposal.countDocuments({ job: job._id });
  const shaped = toJobShape(job, hirer);
  shaped.proposals = proposalCount;
  response.json({ job: shaped });
}

export async function applyToJob(request, response) {
  try {
    const userRole = request.user.activeMode || request.user.role;
    if (userRole !== "SERVICE_PROVIDER") {
      return response.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Only Service Providers can apply for jobs.",
        },
      });
    }

    const jobId = request.params.jobId || request.params.id;
    const job = await Job.findById(jobId);

    if (!job || job.status !== "OPEN") {
      return response.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Open job listing not found." },
      });
    }

    // Check duplicate application
    const existingProposal = await Proposal.findOne({
      job: jobId,
      provider: request.user.id,
    });

    if (existingProposal) {
      return response.status(409).json({
        success: false,
        error: {
          code: "DUPLICATE_APPLICATION",
          message: "You have already applied for this job.",
        },
      });
    }

    const amount = parseAmount(
      request.body.amount || job.budget?.max || job.budget?.min || 0,
    );

    // Strict Proposal Budget Range Enforcement
    if (
      amount < (job.budget?.min || 0) ||
      amount > (job.budget?.max || Infinity)
    ) {
      return response.status(400).json({
        success: false,
        error: {
          code: "INVALID_AMOUNT",
          message: `Your offer must be between ৳${job.budget?.min || 0} and ৳${job.budget?.max || 0}.`,
        },
      });
    }
    const message = String(
      request.body.message ||
        request.body.coverNote ||
        "Interested in this job",
    ).trim();

    const proposal = await Proposal.create({
      job: jobId,
      provider: request.user.id,
      amount,
      message,
      status: "PENDING",
    });

    return response.status(201).json({
      success: true,
      message: "Job application submitted successfully",
      proposal,
    });
  } catch (error) {
    console.error("applyToJob error:", error);
    return response.status(500).json({
      success: false,
      error: {
        code: "APPLICATION_FAILED",
        message: "Failed to submit job application",
      },
    });
  }
}

export async function submitProposal(request, response) {
  if (request.user.activeMode !== "SERVICE_PROVIDER")
    return response
      .status(403)
      .json({ error: "Service Provider mode required" });
  const job = await Job.findOne({ _id: request.params.jobId, status: "OPEN" });
  if (!job) return response.status(404).json({ error: "Open job not found" });
  const amount = parseAmount(request.body.amount || 0);

  if (
    amount < (job.budget?.min || 0) ||
    amount > (job.budget?.max || Infinity)
  ) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_AMOUNT",
        message: `Your offer must be between ৳${job.budget?.min || 0} and ৳${job.budget?.max || 0}.`,
      },
    });
  }

  const proposal = await Proposal.create({
    ...request.body,
    amount,
    job: job.id,
    provider: request.user.id,
  });

  // Notify Hirer
  const notif = await Notification.create({
    user: job.hirer,
    type: "NEW_PROPOSAL",
    title: "New Proposal",
    message: `A provider has submitted a proposal for your job: ${job.title}`,
    link: `/hirer/jobs/${job.id}/applicants`,
  });
  emitNotification(job.hirer.toString(), notif);

  response.status(201).json({ proposal });
}

export async function listProposals(request, response) {
  const job = await Job.findById(request.params.jobId);
  if (
    !job ||
    (job.hirer.toString() !== request.user.id &&
      request.user.id !== String(request.user._id))
  )
    return response.status(404).json({ error: "Job not found" });
  const proposals = await Proposal.find({ job: job.id })
    .populate("provider", "name emailVerified nidVerified")
    .sort({ createdAt: -1 });
  response.json({ proposals });
}

export async function getHirerJobs(request, response) {
  try {
    const userId = request.user.id;
    const userRole = request.user.activeMode || request.user.role;

    if (userRole !== "HIRER") {
      return response.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Only Hirers can view posted job listings.",
        },
      });
    }

    const jobs = await Job.find({
      $or: [{ hirer: userId }, { hirerId: userId }],
    })
      .populate("acceptedProposal", "amount")
      .sort({ createdAt: -1 })
      .lean();

    const jobIds = jobs.map((j) => j._id);

    const proposalCounts = await Proposal.aggregate([
      { $match: { job: { $in: jobIds } } },
      { $group: { _id: "$job", count: { $sum: 1 } } },
    ]);

    const reviews = await Review.find({ job: { $in: jobIds }, reviewer: userId }).select("job").lean();
    const reviewedJobIds = new Set(reviews.map(r => r.job.toString()));

    const countMap = new Map(
      proposalCounts.map((item) => [item._id.toString(), item.count]),
    );

    const shapedJobs = jobs.map((job) => {
      const applicantCount = countMap.get(job._id.toString()) || 0;
      return {
        id: job._id.toString(),
        title: job.title,
        description: job.description,
        category: job.category || job.serviceType || "General",
        serviceType: job.serviceType || job.category || "General",
        location: job.location?.district || "Bangladesh",
        district: job.location?.district || "",
        address: job.location?.address || "",
        budget: {
          min: Number(job.budget?.min || 0),
          max: Number(job.budget?.max || 0),
          type: job.budget?.type || "FIXED",
        },
        payRate: job.payRate || 0,
        status: String(job.status || "OPEN").toUpperCase(),
        postedAt: job.createdAt,
        deadline: job.deadline || null,
        skills: Array.isArray(job.skills) ? job.skills : [],
        applicantCount,
        totalApplicants: applicantCount,
        proposalsCount: applicantCount,
        acceptedProposalAmount: job.acceptedProposal?.amount || 0,
        hasReviewed: reviewedJobIds.has(job._id.toString()),
      };
    });

    return response.json({
      success: true,
      jobs: shapedJobs,
    });
  } catch (error) {
    console.error("getHirerJobs error:", error);
    return response.status(500).json({
      success: false,
      error: {
        code: "FETCH_FAILED",
        message: "Failed to retrieve posted jobs.",
      },
    });
  }
}

export async function getJobApplicants(request, response) {
  try {
    const userId = request.user.id;
    const jobId = request.params.jobId;
    console.log("getJobApplicants called for jobId:", jobId, "by user:", userId);

    const job = await Job.findById(jobId).lean();
    if (!job) {
      return response.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Job post not found." },
      });
    }

    const isOwner =
      String(job.hirer) === userId || String(job.hirerId) === userId;
    if (!isOwner) {
      return response.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "You are not authorized to view applicants for this job.",
        },
      });
    }

    const proposals = await Proposal.find({ job: jobId })
      .populate(
        "provider",
        "name email phone avatar location profile nidVerified",
      )
      .sort({ createdAt: -1 })
      .lean();

    const applicants = proposals.map((prop) => {
      const provider = prop.provider || {};
      const profile = provider.profile || {};
      const initials = (provider.name || "Provider")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase();

      return {
        proposalId: prop._id.toString(),
        id: prop._id.toString(),
        jobId: jobId,
        status: prop.status,
        amount: prop.amount,
        note: prop.message,
        message: prop.message,
        appliedDate: prop.createdAt,
        createdAt: prop.createdAt,
        provider: {
          id: provider._id ? provider._id.toString() : "",
          name: provider.name || "Anonymous Provider",
          email: provider.email || "",
          phone: provider.phone || "N/A",
          avatar: provider.avatar || "",
          initials,
          nidVerified: !!provider.nidVerified,
          location: provider.location?.district || provider.location?.division || profile.district || "Bangladesh",
          district: profile.district || provider.location?.district || "",
          category: profile.category || job.category || "General",
          skills: Array.isArray(profile.skills) ? profile.skills : [],
          hourlyRate: Number(profile.hourlyRate || 0),
          rating: Number(profile.rating || 0),
          reviews: Number(profile.reviews || 0),
          completedJobs: Number(profile.completedJobs || 0),
          bio: profile.bio || "",
          workingHours: profile.workingHours || "Flexible",
          availableNow: !!profile.availableNow,
        },
      };
    });

    return response.json({
      success: true,
      job: {
        id: job._id.toString(),
        title: job.title,
        status: job.status,
        category: job.category,
        budget: job.budget,
        postedAt: job.createdAt,
      },
      applicants,
    });
  } catch (error) {
    console.error("getJobApplicants error:", error);
    return response.status(500).json({
      success: false,
      error: {
        code: "FETCH_FAILED",
        message: "Failed to retrieve job applicants.",
      },
    });
  }
}

export async function deleteJob(request, response) {
  try {
    const job = await Job.findById(request.params.jobId);
    if (!job) {
      return response
        .status(404)
        .json({
          success: false,
          error: { code: "NOT_FOUND", message: "Job not found" },
        });
    }

    if (job.hirer.toString() !== request.user.id) {
      return response
        .status(403)
        .json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only the job poster can delete this job",
          },
        });
    }

    // Only allow deletion of OPEN jobs (can't delete in-progress/completed/paid jobs)
    const blockedStatuses = [
      "IN_PROGRESS",
      "PAYMENT_CONFIRMED",
      "COMPLETED",
      "PAYMENT_PENDING",
    ];
    if (blockedStatuses.includes(String(job.status).toUpperCase())) {
      return response.status(409).json({
        success: false,
        error: {
          code: "CANNOT_DELETE",
          message:
            "Cannot delete a job that is in progress, has confirmed payment, or is completed",
        },
      });
    }

    // Cancel pending proposals
    await Proposal.updateMany(
      { job: job._id, status: { $in: ["PENDING", "SUBMITTED"] } },
      { $set: { status: "CANCELLED" } },
    );

    // Archive associated chats so they remain for record-keeping
    await JobChat.updateMany({ job: job._id }, { $set: { isArchived: true } });

    await Job.deleteOne({ _id: job._id });

    return response.json({
      success: true,
      message: "Job post deleted successfully",
    });
  } catch (error) {
    console.error("deleteJob error:", error);
    return response.status(500).json({
      success: false,
      error: {
        code: "DELETE_FAILED",
        message: "Failed to delete job post. Please try again.",
      },
    });
  }
}

export async function acceptProposal(request, response) {
  try {
    const { jobId, proposalId } = request.params;
    const userId = request.user.id;

    const job = await Job.findById(jobId);
    if (!job) {
      return response
        .status(404)
        .json({
          success: false,
          error: { code: "NOT_FOUND", message: "Job not found" },
        });
    }

    if (String(job.hirer) !== userId && String(job.hirerId) !== userId) {
      return response
        .status(403)
        .json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only the hirer can accept proposals",
          },
        });
    }

    if (job.status !== "OPEN") {
      return response
        .status(400)
        .json({
          success: false,
          error: { code: "INVALID_STATE", message: "Job is no longer open" },
        });
    }

    const proposal = await Proposal.findById(proposalId);
    if (!proposal || String(proposal.job) !== String(job._id)) {
      return response
        .status(404)
        .json({
          success: false,
          error: { code: "NOT_FOUND", message: "Proposal not found" },
        });
    }

    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        proposal.status = "ACCEPTED";
        await proposal.save({ session: dbSession });

        await Proposal.updateMany(
          { job: job._id, _id: { $ne: proposal._id }, status: "PENDING" },
          { $set: { status: "REJECTED" } },
          { session: dbSession },
        );

        job.status = "PAYMENT_PENDING";
        job.acceptedProposal = proposal._id;
        await job.save({ session: dbSession });
      });
    } finally {
      await dbSession.endSession();
    }

    // Notify Provider
    const acceptNotif = await Notification.create({
      user: proposal.provider,
      type: "PROPOSAL_ACCEPTED",
      title: "Proposal Accepted",
      message: `Your proposal for "${job.title}" has been accepted. The hirer is pending payment.`,
      link: `/provider/jobs`,
    });
    emitNotification(proposal.provider.toString(), acceptNotif);

    // Notify Rejected Providers
    const rejectedProposals = await Proposal.find({
      job: job._id,
      status: "REJECTED",
    }).lean();
    for (const rp of rejectedProposals) {
      if (rp._id.toString() !== proposal._id.toString()) {
        const rejectNotif = await Notification.create({
          user: rp.provider,
          type: "PROPOSAL_REJECTED",
          title: "Proposal Rejected",
          message: `Your proposal for "${job.title}" was not selected.`,
          link: `/provider/jobs`,
        });
        emitNotification(rp.provider.toString(), rejectNotif);
      }
    }

    return response.json({
      success: true,
      message: "Proposal accepted successfully. Job is now in progress.",
    });
  } catch (error) {
    console.error("acceptProposal error:", error);
    return response
      .status(500)
      .json({
        success: false,
        error: { code: "SERVER_ERROR", message: "Failed to accept proposal" },
      });
  }
}

export async function rejectProposal(request, response) {
  try {
    const { jobId, proposalId } = request.params;
    const userId = request.user.id;

    const job = await Job.findById(jobId);
    if (!job) {
      return response
        .status(404)
        .json({
          success: false,
          error: { code: "NOT_FOUND", message: "Job not found" },
        });
    }

    if (String(job.hirer) !== userId && String(job.hirerId) !== userId) {
      return response
        .status(403)
        .json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only the hirer can reject proposals",
          },
        });
    }

    const proposal = await Proposal.findById(proposalId);
    if (!proposal || String(proposal.job) !== String(job._id)) {
      return response
        .status(404)
        .json({
          success: false,
          error: { code: "NOT_FOUND", message: "Proposal not found" },
        });
    }

    if (proposal.status !== "PENDING") {
      return response
        .status(400)
        .json({
          success: false,
          error: {
            code: "INVALID_STATE",
            message: "Only pending proposals can be rejected",
          },
        });
    }

    proposal.status = "REJECTED";
    await proposal.save();

    const rejectNotif = await Notification.create({
      user: proposal.provider,
      type: "PROPOSAL_REJECTED",
      title: "Proposal Rejected",
      message: `Your proposal for "${job.title}" has been rejected.`,
      link: `/provider/jobs`,
    });
    emitNotification(proposal.provider.toString(), rejectNotif);

    return response.json({
      success: true,
      message: "Proposal rejected successfully",
    });
  } catch (error) {
    console.error("rejectProposal error:", error);
    return response
      .status(500)
      .json({
        success: false,
        error: { code: "SERVER_ERROR", message: "Failed to reject proposal" },
      });
  }
}

export async function updateProposalStatus(request, response) {
  const { status } = request.body || {};
  const proposal = await Proposal.findById(request.params.proposalId)
    .select("job")
    .lean();
  if (!proposal) {
    return response.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Proposal not found" },
    });
  }

  request.params.jobId = proposal.job.toString();
  if (String(status).toLowerCase() === "accepted") {
    return acceptProposal(request, response);
  }
  if (String(status).toLowerCase() === "rejected") {
    return rejectProposal(request, response);
  }
  return response.status(400).json({
    success: false,
    error: {
      code: "INVALID_STATUS",
      message: "Status must be accepted or rejected",
    },
  });
}

export async function getMyApplications(request, response) {
  try {
    const proposals = await Proposal.find({ provider: request.user._id })
      .populate("job")
      .lean();
    return response.json({
      applications: proposals.map((p) => ({
        ...p.job,
        applicationStatus: p.status,
        proposalId: p._id,
      })),
    });
  } catch (error) {
    console.error("getMyApplications error:", error);
    return response
      .status(500)
      .json({
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "Failed to fetch applications",
        },
      });
  }
}
