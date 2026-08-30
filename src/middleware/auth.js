import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { Admin } from "../models/Admin.js";
import { config } from "../config.js";

export async function authenticate(request, response, next) {
  try {
    const payload = jwt.verify(
      request.cookies.access_token || "",
      config.accessSecret,
      { algorithms: ["HS256"] },
    );
    if (payload.accountType !== "USER" || typeof payload.userId !== "string")
      return response.status(401).json({ error: "Unauthorized" });
    const user = await User.findById(payload.userId).select("-passwordHash");
    if (!user || user.suspended)
      return response.status(401).json({ error: "Unauthorized" });
    request.user = user;
    next();
  } catch {
    response.status(401).json({ error: "Unauthorized" });
  }
}

export async function authenticateAdmin(request, response, next) {
  try {
    const payload = jwt.verify(
      request.cookies.admin_access_token || "",
      config.accessSecret,
      { algorithms: ["HS256"] },
    );
    if (
      !["ADMIN", "SUPER_ADMIN", "SUPERADMIN"].includes(payload.accountType) ||
      typeof payload.userId !== "string"
    )
      return response.status(401).json({ error: "Unauthorized" });
    const admin = await Admin.findById(payload.userId).select("-passwordHash");
    if (!admin || admin.suspended)
      return response.status(401).json({ error: "Unauthorized" });
    request.admin = admin;
    next();
  } catch {
    response.status(401).json({ error: "Unauthorized" });
  }
}

export function requireVerifiedNID(request, response, next) {
  if (request.user?.nidVerified !== true)
    return response.status(403).json({ error: "NID verification required" });
  next();
}

export function requireAdmin(request, response, next) {
  if (!["ADMIN", "SUPER_ADMIN"].includes(request.admin?.role))
    return response.status(403).json({ error: "Forbidden" });
  next();
}

export function requireSuperAdmin(request, response, next) {
  if (!["SUPER_ADMIN", "SUPERADMIN"].includes(request.admin?.role))
    return response.status(403).json({ error: "Forbidden" });
  next();
}
