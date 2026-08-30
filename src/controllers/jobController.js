import mongoose from "mongoose";
import { Job } from "../models/Job.js";
import { Proposal } from "../models/Proposal.js";
import { JobChat } from "../models/JobChat.js";
import { User } from "../models/User.js";

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

  const hirerIds = [...new Set(jobs.map((job) => String(job.hirer)))];
  const hirers = await User.find({ _id: { $in: hirerIds } })
    .select("name nidVerified")
    .lean();
  const hirerMap = new Map(hirers.map((hirer) => [String(hirer._id), hirer]));

  response.json({
    jobs: jobs.map((job) => toJobShape(job, hirerMap.get(String(job.hirer)))),
  });
}

export async function createJob(request, response) {
  const role = request.user?.role || request.user?.activeMode;
  if (role !== "HIRER")
    return response
      .status(403)
      .json({ error: "Hirer account required to post a job" });

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

  if (!title || !description || !category || !location?.district)
    return response
      .status(400)
      .json({
        error: "Title, description, category, and location are required",
      });

  const budgetValue =
    budget && typeof budget === "object"
      ? budget
      : {
          min: Number(request.body.budgetMin || 0),
          max: Number(request.body.budgetMax || 0),
          type: String(request.body.budgetType || "FIXED").toUpperCase(),
        };

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
      district: String(location.district).trim(),
      address: String(location.address || "").trim(),
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
  response.json({ job: toJobShape(job, hirer) });
}

export async function submitProposal(request, response) {
  if (request.user.activeMode !== "SERVICE_PROVIDER")
    return response
      .status(403)
      .json({ error: "Service Provider mode required" });
  const job = await Job.findOne({ _id: request.params.jobId, status: "OPEN" });
  if (!job) return response.status(404).json({ error: "Open job not found" });
  const proposal = await Proposal.create({
    ...request.body,
    job: job.id,
    provider: request.user.id,
  });
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

export async function acceptProposal(request, response) {
  const dbSession = await mongoose.startSession();
  try {
    let accepted;
    await dbSession.withTransaction(async () => {
      const job = await Job.findOne({
        _id: request.params.jobId,
        hirer: request.user.id,
        status: "OPEN",
      }).session(dbSession);
      const proposal = await Proposal.findOne({
        _id: request.params.proposalId,
        job: request.params.jobId,
        status: "PENDING",
      }).session(dbSession);
      if (!job || !proposal)
        throw Object.assign(new Error("Proposal not found"), {
          statusCode: 404,
        });
      job.acceptedProposal = proposal.id;
      job.status = "PAYMENT_PENDING";
      await job.save({ session: dbSession });
      proposal.status = "ACCEPTED";
      await proposal.save({ session: dbSession });
      await Proposal.updateMany(
        { job: job.id, _id: { $ne: proposal.id }, status: "PENDING" },
        { $set: { status: "REJECTED" } },
        { session: dbSession },
      );
      await JobChat.updateMany(
        { job: job.id, proposal: { $ne: proposal.id } },
        { $set: { isArchived: true } },
        { session: dbSession },
      );
      accepted = proposal;
    });
    response.json({ proposal: accepted });
  } finally {
    await dbSession.endSession();
  }
}
