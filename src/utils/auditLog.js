import { AuditLog } from "../models/AuditLog.js";

export async function logAuditAction({
  adminId,
  action,
  targetType,
  targetId = "",
  details = {},
  ipAddress = "",
}) {
  try {
    await AuditLog.create({
      admin: adminId,
      action,
      targetType,
      targetId,
      details,
      ipAddress,
    });
  } catch (error) {
    console.error("logAuditAction error:", error);
  }
}
