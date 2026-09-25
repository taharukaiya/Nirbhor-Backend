/**
 * Admin RBAC (Role-Based Access Control) Middleware
 * 
 * Architectural Intent:
 * Provides a granular, boolean-based permissions matrix for the Admin Dashboard. 
 * Allows scaling the admin team without giving junior moderators full system control.
 * 
 * Logic:
 * `requireAdminRole`: Enforces hierarchy (SUPER_ADMIN > ADMIN).
 * `requirePermission`: Enforces horizontal limits (e.g., can moderate users, but cannot approve payouts).
 */

export function requireAdminRole(requiredRole = "ADMIN") {
  return (request, response, next) => {
    if (!request.admin) {
      return response.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Admin authentication required",
        },
      });
    }

    const adminRoles = {
      ADMIN: 1,
      SUPER_ADMIN: 2,
      SUPERADMIN: 2,
    };

    const requiredLevel = adminRoles[requiredRole] || 1;
    const currentLevel = adminRoles[request.admin.role] || 0;

    if (currentLevel < requiredLevel) {
      return response.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: `Requires ${requiredRole} privilege`,
        },
      });
    }

    next();
  };
}

/**
 * Permission-based access control middleware.
 */
export function requirePermission(permission) {
  return (request, response, next) => {
    if (!request.admin) {
      return response.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Admin authentication required",
        },
      });
    }

    // Super admins have all permissions
    if (
      request.admin.role === "SUPER_ADMIN" ||
      request.admin.role === "SUPERADMIN"
    ) {
      return next();
    }

    // Check specific permission
    if (!request.admin.permissions?.[permission]) {
      return response.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: `Permission denied: ${permission}`,
        },
      });
    }

    next();
  };
}
