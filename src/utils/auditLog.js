/**
 * Audit Logger Utility
 * 
 * Architectural Intent:
 * Provides a fire-and-forget wrapper around the `AuditLog` model. 
 * This ensures that if the audit logging itself fails (e.g., DB timeout), 
 * it does not crash the underlying administrative action being performed.
 * Essential for SOC2 / ISO27001 compliance tracking of Admin actions.
 */
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
    // Fail silently to prevent interrupting the primary admin mutation
    console.error("logAuditAction error:", error);
  }
}
