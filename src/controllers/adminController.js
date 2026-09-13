import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { Admin } from "../models/Admin.js";
import { User } from "../models/User.js";
import { Category } from "../models/Category.js";
import { Job } from "../models/Job.js";
import { Dispute } from "../models/Dispute.js";
import { EscrowPayment } from "../models/EscrowPayment.js";
import { JobChat } from "../models/JobChat.js";
import { AuditLog } from "../models/AuditLog.js";
import { logAuditAction } from "../utils/auditLog.js";

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
  try {
    const [
      totalUsers,
      totalJobs,
      activeJobs,
      totalDisputes,
      openDisputes,
      nidVerifiedCount,
      pendingNidCount,
      payments,
    ] = await Promise.all([
      User.countDocuments(),
      Job.countDocuments(),
      Job.countDocuments({ status: { $in: ["OPEN", "IN_PROGRESS", "PAYMENT_PENDING"] } }),
      Dispute.countDocuments(),
      Dispute.countDocuments({ status: { $in: ["OPEN", "UNDER_REVIEW"] } }),
      User.countDocuments({ nidVerified: true }),
      User.countDocuments({ nidSubmittedAt: { $ne: null }, nidVerified: false }),
      EscrowPayment.find({ status: { $in: ["HELD_IN_ESCROW", "RELEASED"] } }).select("amount platformFee"),
    ]);

    const totalGrossPaymentVolume = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalPlatformCommission = payments.reduce((sum, p) => sum + (p.platformFee || 0), 0);

    const recentUsers = await User.find()
      .select("name email role createdAt nidVerified activeMode")
      .limit(5)
      .sort({ createdAt: -1 })
      .lean();

    const recentJobs = await Job.find()
      .select("title status category createdAt budget")
      .limit(5)
      .sort({ createdAt: -1 })
      .lean();

    return response.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalJobs,
          activeJobs,
          totalDisputes,
          openDisputes,
          nidVerifiedCount,
          pendingNidCount,
          ...(request.admin?.role === "SUPER_ADMIN" ? {
            totalGrossPaymentVolume,
            totalPlatformCommission,
            platformCommissionRate: 5,
          } : {}),
          nidVerificationRate: totalUsers
            ? ((nidVerifiedCount / totalUsers) * 100).toFixed(1)
            : 0,
        },
        recentUsers,
        recentJobs,
      },
    });
  } catch (error) {
    console.error("getSystemStats error:", error);
    return response.status(500).json({
      success: false,
      error: { code: "METRICS_FAILED", message: "Failed to load platform metrics" },
    });
  }
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
  const adminIdToRevoke = request.params.adminId;
  const currentAdminId = request.admin?._id || request.admin?.id;

  if (String(adminIdToRevoke) === String(currentAdminId)) {
    return response.status(403).json({
      success: false,
      error: { code: "FORBIDDEN", message: "Cannot revoke your own admin access" },
    });
  }

  const adminToRevoke = await Admin.findById(adminIdToRevoke);
  if (!adminToRevoke) {
    return response.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Admin not found" },
    });
  }

  if (adminToRevoke.role === "SUPER_ADMIN") {
    return response.status(403).json({
      success: false,
      error: { code: "FORBIDDEN", message: "Cannot revoke another SUPER_ADMIN" },
    });
  }

  adminToRevoke.active = false;
  await adminToRevoke.save();

  return response.json({
    success: true,
    data: { admin: adminToRevoke },
    message: "Admin status revoked",
  });
}

export async function createCategory(request, response) {
  try {
    const existingCategory = await Category.findOne({ slug: request.body.slug });

    if (existingCategory) {
      if (existingCategory.isActive) {
        return response.status(409).json({ error: "Category already exists" });
      } else {
        // Restore soft-deleted category
        existingCategory.name = request.body.name;
        existingCategory.isActive = true;
        existingCategory.icon = request.body.icon || "";
        existingCategory.description = request.body.description || "";
        await existingCategory.save();
        return response.status(200).json({ category: existingCategory });
      }
    }

    const category = await Category.create({
      name: request.body.name,
      slug: request.body.slug,
      icon: request.body.icon || "",
      description: request.body.description || "",
    });
    return response.status(201).json({ category });
  } catch (err) {
    return response.status(500).json({ error: err.message || "Failed to create category" });
  }
}

export async function listCategories(_request, response) {
  response.json({
    categories: await Category.find({ isActive: true })
      .sort({ name: 1 })
      .lean(),
  });
}

export async function deleteCategory(request, response) {
  const category = await Category.findByIdAndUpdate(
    request.params.id,
    { isActive: false },
    { new: true }
  );
  if (!category) {
    return response.status(404).json({ error: "Category not found" });
  }
  response.json({ message: "Category deleted", category });
}

export async function listDisputes(request, response) {
  const disputes = await Dispute.find()
    .populate("job", "title category status budget hirer")
    .populate("openedBy", "name email role")
    .populate("resolvedBy", "name email")
    .sort({ createdAt: -1 })
    .lean();

  return response.json({ success: true, disputes });
}

export async function resolveDispute(request, response) {
  const { disputeId } = request.params;
  const { decision, resolutionText } = request.body;
  const adminId = request.admin?._id || request.admin?.id;

  if (!["REFUND_HIRER", "PAY_PROVIDER", "SPLIT_PAYOUT"].includes(decision)) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_DECISION",
        message: "Decision must be REFUND_HIRER, PAY_PROVIDER, or SPLIT_PAYOUT",
      },
    });
  }

  const dispute = await Dispute.findById(disputeId);
  if (!dispute || dispute.status === "RESOLVED") {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_DISPUTE",
        message: "Dispute not found or already resolved",
      },
    });
  }

  const dbSession = await mongoose.startSession();
  try {
    await dbSession.withTransaction(async () => {
      dispute.status = "RESOLVED";
      dispute.resolution = resolutionText || decision;
      dispute.resolvedBy = adminId;
      await dispute.save({ session: dbSession });

      const payment = await EscrowPayment.findOne({ job: dispute.job }).session(
        dbSession,
      );
      if (payment && payment.status === "HELD_IN_ESCROW") {
        if (decision === "REFUND_HIRER") {
          payment.status = "REFUNDED";
        } else if (decision === "PAY_PROVIDER" || decision === "SPLIT_PAYOUT") {
          payment.status = "RELEASED";
          payment.releasedAt = new Date();
        }
        await payment.save({ session: dbSession });
      }

      await Job.updateOne(
        { _id: dispute.job },
        {
          $set: {
            status: decision === "REFUND_HIRER" ? "CANCELLED" : "COMPLETED",
          },
        },
        { session: dbSession },
      );
    });

    await logAuditAction({
      adminId,
      action: "RESOLVE_DISPUTE",
      targetType: "Dispute",
      targetId: disputeId,
      details: { decision, resolutionText, jobId: dispute.job },
      ipAddress: request.ip,
    });

    return response.json({
      success: true,
      message: "Dispute resolved successfully",
      dispute,
    });
  } finally {
    await dbSession.endSession();
  }
}

export async function listAuditLogs(request, response) {
  const page = Math.max(1, Number(request.query.page) || 1);
  const limit = Math.min(Math.max(Number(request.query.limit) || 50, 1), 100);
  const skip = (page - 1) * limit;

  const auditLogs = await AuditLog.find()
    .populate("admin", "name email role")
    .limit(limit)
    .skip(skip)
    .sort({ createdAt: -1 })
    .lean();

  const total = await AuditLog.countDocuments();

  return response.json({
    success: true,
    data: {
      auditLogs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
}

export async function getPendingVerifications(request, response) {
  try {
    const status = request.query.status;
    const filter = {};
    if (status === "pending") {
      filter.nidSubmittedAt = { $ne: null };
      filter.nidVerified = false;
    } else if (status === "verified") {
      filter.nidVerified = true;
    } else {
      filter.nidSubmittedAt = { $ne: null };
    }

    const users = await User.find(filter)
      .select("name email phone location avatar nidNumber dateOfBirth nidSubmittedAt nidVerified createdAt activeMode profile")
      .sort({ nidSubmittedAt: -1, createdAt: -1 })
      .lean();

    return response.json({
      success: true,
      verifications: users.map((u) => ({
        id: u._id.toString(),
        userId: u._id.toString(),
        name: u.name,
        email: u.email,
        phone: u.phone || "N/A",
        location: u.location || u.profile?.district || "Bangladesh",
        nidNumber: u.nidNumber || "N/A",
        dateOfBirth: u.dateOfBirth || null,
        submittedAt: u.nidSubmittedAt || u.createdAt,
        status: u.nidVerified ? "VERIFIED" : u.nidSubmittedAt ? "PENDING" : "UNSUBMITTED",
        nidVerified: !!u.nidVerified,
      })),
    });
  } catch (error) {
    console.error("getPendingVerifications error:", error);
    return response.status(500).json({
      success: false,
      error: { code: "FETCH_FAILED", message: "Failed to retrieve NID verifications." },
    });
  }
}

export async function getDisputeDetails(request, response) {
  try {
    const { disputeId } = request.params;
    const dispute = await Dispute.findById(disputeId)
      .populate("job")
      .populate("openedBy", "name email phone avatar role")
      .populate("resolvedBy", "name email")
      .lean();

    if (!dispute) {
      return response.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Dispute record not found." },
      });
    }

    const job = dispute.job || {};
    const payment = await EscrowPayment.findOne({ job: job._id }).lean();
    const chatLogs = await JobChat.findOne({ job: job._id })
      .populate("messages.sender", "name email avatar")
      .lean();

    return response.json({
      success: true,
      dispute: {
        id: dispute._id.toString(),
        reason: dispute.reason,
        status: dispute.status,
        resolution: dispute.resolution || "",
        createdAt: dispute.createdAt,
        openedBy: dispute.openedBy,
        resolvedBy: dispute.resolvedBy,
        job: {
          id: job._id?.toString(),
          title: job.title,
          description: job.description,
          category: job.category,
          budget: job.budget,
          status: job.status,
        },
        payment: payment
          ? {
              id: payment._id.toString(),
              amount: payment.amount,
              platformFee: payment.platformFee,
              providerNetPayout: payment.providerNetPayout,
              status: payment.status,
            }
          : null,
        chatLogs: chatLogs?.messages || [],
      },
    });
  } catch (error) {
    console.error("getDisputeDetails error:", error);
    return response.status(500).json({
      success: false,
      error: { code: "FETCH_FAILED", message: "Failed to retrieve dispute details." },
    });
  }
}

export async function updateAdminPermissions(request, response) {
  try {
    const { adminId } = request.params;
    const { permissions } = request.body;

    if (!permissions || typeof permissions !== "object") {
      return response.status(400).json({
        success: false,
        error: { code: "INVALID_PERMISSIONS", message: "Permissions object is required." },
      });
    }

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return response.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Admin account not found." },
      });
    }

    admin.permissions = {
      ...admin.permissions,
      ...permissions,
    };
    await admin.save();

    await logAuditAction({
      adminId: request.admin?._id || request.admin?.id,
      action: "UPDATE_ADMIN_PERMISSIONS",
      targetType: "Admin",
      targetId: adminId,
      details: { permissions: admin.permissions },
      ipAddress: request.ip,
    });

    return response.json({
      success: true,
      message: "Admin permissions updated successfully",
      admin: {
        id: admin._id.toString(),
        email: admin.email,
        name: admin.name,
        role: admin.role,
        permissions: admin.permissions,
      },
    });
  } catch (error) {
    console.error("updateAdminPermissions error:", error);
    return response.status(500).json({
      success: false,
      error: { code: "UPDATE_FAILED", message: "Failed to update admin permissions." },
    });
  }
}
