import bcrypt from "bcryptjs";
import { Admin } from "../models/Admin.js";
import { User } from "../models/User.js";
import { Category } from "../models/Category.js";
import { Job } from "../models/Job.js";
import { Dispute } from "../models/Dispute.js";

export async function createAdmin(request, response) {
  const { email, password, name, role } = request.body;
  if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
    return response.status(400).json({ error: "Invalid role" });
  }
  const admin = await Admin.create({
    email: email.trim().toLowerCase(),
    name: String(name).trim(),
    passwordHash: await bcrypt.hash(password, 12),
    role,
    permissions: {
      canManageUsers: true,
      canManageJobs: true,
      canHandleDisputes: true,
      canVerifyNID: true,
      canPromoteAdmins: role === "SUPER_ADMIN",
      canViewAuditLogs: true,
      canModerateContent: true,
      canSuspendUsers: true,
    },
  });
  return response.status(201).json({
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    },
  });
}

export async function listUsers(request, response) {
  const page = Math.max(1, Number(request.query.page) || 1);
  const limit = Math.min(Math.max(Number(request.query.limit) || 50, 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};
  if (request.query.role) {
    filter.role = request.query.role;
  }
  if (request.query.verified !== undefined) {
    filter.nidVerified = request.query.verified === "true";
  }

  const users = await User.find(filter)
    .select("-passwordHash -refreshTokens")
    .limit(limit)
    .skip(skip)
    .sort({ createdAt: -1 })
    .lean();

  const total = await User.countDocuments(filter);

  return response.json({
    success: true,
    data: {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
}

export async function getSystemStats(request, response) {
  const [totalUsers, totalJobs, totalDisputes, nidVerifiedCount] =
    await Promise.all([
      User.countDocuments(),
      Job.countDocuments(),
      Dispute.countDocuments(),
      User.countDocuments({ nidVerified: true }),
    ]);

  const recentUsers = await User.find()
    .select("name email role createdAt nidVerified")
    .limit(5)
    .sort({ createdAt: -1 })
    .lean();

  const recentJobs = await Job.find()
    .select("title status createdAt")
    .limit(5)
    .sort({ createdAt: -1 })
    .lean();

  return response.json({
    success: true,
    data: {
      stats: {
        totalUsers,
        totalJobs,
        totalDisputes,
        nidVerifiedCount,
        nidVerificationRate: totalUsers
          ? ((nidVerifiedCount / totalUsers) * 100).toFixed(2)
          : 0,
      },
      recentUsers,
      recentJobs,
    },
  });
}

export async function suspendUser(request, response) {
  const user = await User.findByIdAndUpdate(
    request.params.userId,
    { suspended: true },
    { new: true },
  ).select("-passwordHash");
  if (!user) return response.status(404).json({ error: "User not found" });
  response.json({ user });
}

export async function reviewNid(request, response) {
  const user = await User.findByIdAndUpdate(
    request.params.userId,
    { nidVerified: Boolean(request.body.approved) },
    { new: true },
  ).select("-passwordHash");
  if (!user) return response.status(404).json({ error: "User not found" });
  response.json({ user });
}

export async function promoteUserToAdmin(request, response) {
  const { tier, permissions } = request.body;

  if (!["ADMIN", "SUPER_ADMIN"].includes(tier)) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_TIER",
        message: "tier must be ADMIN or SUPER_ADMIN",
      },
    });
  }

  // Check if user exists
  const user = await User.findById(request.params.userId);
  if (!user) {
    return response.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "User not found" },
    });
  }

  // Create or update admin record
  const admin = await Admin.findOneAndUpdate(
    { email: user.email },
    {
      email: user.email,
      name: user.name,
      role: tier,
      permissions: permissions || {
        canManageUsers: true,
        canManageJobs: true,
        canHandleDisputes: true,
        canVerifyNID: true,
        canPromoteAdmins: tier === "SUPER_ADMIN",
        canViewAuditLogs: true,
        canModerateContent: true,
        canSuspendUsers: true,
      },
      grantedBy: request.admin?._id,
      active: true,
    },
    { upsert: true, new: true },
  );

  return response.json({
    success: true,
    data: { admin },
    message: `User promoted to ${tier}`,
  });
}

export async function listAdmins(request, response) {
  const admins = await Admin.find({ active: true })
    .select("-passwordHash -refreshTokens")
    .sort({ createdAt: -1 })
    .lean();

  return response.json({
    success: true,
    data: { admins },
  });
}

export async function revokeAdmin(request, response) {
  const admin = await Admin.findByIdAndUpdate(
    request.params.adminId,
    { active: false },
    { new: true },
  );

  if (!admin) {
    return response.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Admin not found" },
    });
  }

  return response.json({
    success: true,
    data: { admin },
    message: "Admin status revoked",
  });
}

export async function createCategory(request, response) {
  const category = await Category.create({
    name: request.body.name,
    slug: request.body.slug,
  });
  response.status(201).json({ category });
}

export async function listCategories(_request, response) {
  response.json({
    categories: await Category.find({ isActive: true })
      .sort({ name: 1 })
      .lean(),
  });
}
