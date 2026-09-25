/**
 * Token generation & hashing utility
 * 
 * Architectural Intent:
 * Implements a dual-token authentication architecture (Access + Refresh tokens).
 * 
 * Security Measures:
 * 1. Access Tokens (short-lived, 15m) are used for rapid stateless verification.
 * 2. Refresh Tokens (long-lived, 7d) are stored in the DB (hashed) and used to mint new Access Tokens.
 * 3. Admins have separate, stricter token lifecycles to limit credential exposure windows.
 * 4. `bcrypt` is used to hash refresh tokens before DB storage to prevent session hijacking if DB leaks.
 */
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { config } from "../config.js";

// Standardized cookie configuration enforcing strict cross-site request forgery (CSRF) protection
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: "strict",
  path: "/",
};

export function issueUserTokens(user) {
  const tokenId = crypto.randomUUID();
  const accessToken = jwt.sign(
    { userId: user.id, accountType: "USER" },
    config.accessSecret,
    { expiresIn: "15m" },
  );
  const refreshToken = jwt.sign(
    { userId: user.id, tokenId },
    config.refreshSecret,
    { expiresIn: "7d" },
  );
  return {
    accessToken,
    refreshToken,
    tokenId,
    expiresAt: new Date(Date.now() + 7 * 86400000),
  };
}

export function issueAdminTokens(admin) {
  const tokenId = crypto.randomUUID();
  const accessToken = jwt.sign(
    {
      userId: admin.id,
      accountType: admin.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN",
    },
    config.accessSecret,
    { expiresIn: "10m" },
  );
  const refreshToken = jwt.sign(
    { userId: admin.id, tokenId },
    config.refreshSecret,
    { expiresIn: "1d" },
  );
  return {
    accessToken,
    refreshToken,
    tokenId,
    expiresAt: new Date(Date.now() + 86400000),
  };
}

/**
 * Temporary tokens used specifically for stateless email verification flows
 */
export function signEmailToken(userId, purpose) {
  return jwt.sign({ userId, purpose }, config.emailSecret, {
    expiresIn: "20m",
  });
}

export function verifyEmailToken(token, purpose) {
  return jwt.verify(token, config.emailSecret, { algorithms: ["HS256"] })
    .purpose === purpose
    ? jwt.verify(token, config.emailSecret, { algorithms: ["HS256"] })
    : null;
}

export function hashToken(token) {
  return bcrypt.hash(token, 12);
}
export function compareToken(token, hash) {
  return bcrypt.compare(token, hash);
}
