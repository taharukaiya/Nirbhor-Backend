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
