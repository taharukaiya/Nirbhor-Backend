/**
 * Error Handling Middleware
 * 
 * Architectural Intent:
 * Centralizes error formatting. Prevents sensitive stack traces from leaking 
 * to the client while providing consistent `{ success: false, error: {...} }` structures.
 * 
 * Features:
 * - `asyncHandler`: Eliminates the need for verbose `try/catch` blocks in every controller.
 * - Global Error Trap: Intercepts Mongoose Validation Errors and Duplicate Key (11000) errors.
 */

export function asyncHandler(handler) {
  return (request, response, next) =>
    Promise.resolve(handler(request, response, next)).catch(next);
}

export function errorHandler(error, _request, response, _next) {
  if (error.type === "entity.parse.failed")
    return response
      .status(400)
      .json({
        success: false,
        data: null,
        error: { code: "INVALID_JSON", message: "Invalid JSON" },
      });
  if (error.name === "ValidationError")
    return response
      .status(400)
      .json({
        success: false,
        data: null,
        error: { code: "VALIDATION_ERROR", message: "Invalid request data" },
      });
  if (error.code === 11000)
    return response
      .status(409)
      .json({
        success: false,
        data: null,
        error: {
          code: "DUPLICATE_RESOURCE",
          message: "Resource already exists",
        },
      });
  console.error(error.message);
  response.status(error.statusCode || 500).json({
    success: false,
    data: null,
    error: {
      code: error.code || "INTERNAL_ERROR",
      message: error.statusCode ? error.message : "Internal server error",
    },
  });
}
