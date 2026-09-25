import mongoose from "mongoose";

/**
 * DB Health Check Middleware
 * 
 * Architectural Intent:
 * Acts as a circuit breaker. In a containerized environment (Docker/K8s), the Node app 
 * might boot up faster than MongoDB. This middleware ensures we return a clear 503 
 * Service Unavailable instead of attempting DB operations and crashing with a 500 error.
 */
export function dbHealthCheck(_request, response, next) {
  if (mongoose.connection.readyState === 1) {
    // 1 = connected
    return next();
  }
  return response.status(503).json({
    success: false,
    error: {
      code: "DATABASE_UNAVAILABLE",
      message: "Service temporarily unavailable. Database connection pending.",
    },
  });
}
