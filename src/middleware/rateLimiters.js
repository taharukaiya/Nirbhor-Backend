import rateLimit from "express-rate-limit";
import { ipKeyGenerator } from "express-rate-limit";

const keyByIpAndEmail = (request) =>
  `${ipKeyGenerator(request.ip)}:${String(request.body?.email || "")
    .trim()
    .toLowerCase()}`;
export const userLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: keyByIpAndEmail,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many login attempts" },
});
export const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: keyByIpAndEmail,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many login attempts" },
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests" },
});
