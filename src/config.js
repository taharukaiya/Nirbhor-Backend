/**
 * Centralized Application Configuration & Environment Validator
 * 
 * Architectural Intent:
 * This module serves as the single source of truth for environment variables across the backend.
 * Instead of scattering `process.env.XYZ` calls throughout the codebase, all variables are parsed, 
 * validated, and exported here. This ensures that the app fails fast on startup if critical secrets 
 * (like JWT signatures or database URIs) are missing, preventing runtime crashes or security breaches later.
 */

import "dotenv/config";

// Critical secrets required for the cryptographic integrity of the application.
// If these are missing or still set to the default placeholder in production, the server will refuse to start.
const required = [
  "MONGO_URI",
  "ACCESS_TOKEN_SECRET",
  "REFRESH_TOKEN_SECRET",
  "EMAIL_TOKEN_SECRET",
];

for (const name of required) {
  if (
    (!process.env[name] || process.env[name].startsWith("replace-with-")) &&
    process.env.NODE_ENV !== "test"
  ) {
    throw new Error(`CRITICAL CONFIG ERROR: ${name} is required in production environment`);
  }
}

/**
 * CORS Origin Resolution:
 * Supports multiple frontend origins to accommodate local development (localhost) 
 * alongside production domains (e.g., nirbhor.com). 
 * Splits comma-separated strings from the `.env` to build an array of allowed origins.
 */
const frontendOrigins = (
  process.env.FRONTEND_ORIGINS ||
  process.env.FRONTEND_ORIGIN ||
  "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const config = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/nirbhor",
  frontendOrigin: frontendOrigins[0], // Primary origin used for email templates & callbacks
  frontendOrigins,                    // Full list of origins allowed by CORS middleware
  accessSecret: process.env.ACCESS_TOKEN_SECRET,
  refreshSecret: process.env.REFRESH_TOKEN_SECRET,
  emailSecret: process.env.EMAIL_TOKEN_SECRET,
  isProduction: process.env.NODE_ENV === "production",
  apiPublicUrl: process.env.API_PUBLIC_URL || "http://localhost:5000",
};

/**
 * Validates incoming HTTP requests against the allowed origins.
 * @param {string} origin - The origin header from the incoming request.
 * @returns {boolean} True if the origin is explicitly permitted or if no origin is provided (e.g., Postman/Server-to-Server).
 */
export function isAllowedOrigin(origin) {
  return !origin || config.frontendOrigins.includes(origin);
}
