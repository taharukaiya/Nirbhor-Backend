/**
 * Express Validator Formatter
 * 
 * Architectural Intent:
 * Centralizes the `express-validator` result extraction.
 * Instead of writing `const errors = validationResult(req)` in every controller, 
 * this middleware intercepts the request, formats the errors neatly, and returns a 400.
 */
import { validationResult } from "express-validator";

export function validate(request, response, next) {
  const errors = validationResult(request);
  if (!errors.isEmpty()) {
    return response.status(400).json({
      error: "Invalid request data",
      details: errors.array({ onlyFirstError: true }),
    });
  }
  next();
}
