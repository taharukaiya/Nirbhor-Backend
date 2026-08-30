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
