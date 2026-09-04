import mongoose from "mongoose";

/**
 * Middleware to check if MongoDB connection is ready.
 * Returns 503 Service Unavailable if DB is not connected.
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
