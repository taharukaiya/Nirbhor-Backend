import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { config } from "../config.js";

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
