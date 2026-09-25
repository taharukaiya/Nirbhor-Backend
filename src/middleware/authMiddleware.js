/**
 * Authorization Utility Exporter
 * 
 * Architectural Intent:
 * Provides a unified import boundary for auth helpers and a specific `authorizeRoles` 
 * factory for route-level role assertions.
 */
export {
  authenticate,
  authenticateAdmin,
  requireVerifiedNID,
  requireAdmin,
  requireSuperAdmin,
} from "./auth.js";

export function authorizeRoles(...roles) {
  return (request, response, next) => {
    const role =
      request.user?.accountType || request.user?.role || request.admin?.role;
    if (!roles.includes(role))
      return response.status(403).json({ error: "Forbidden" });
    next();
  };
}
