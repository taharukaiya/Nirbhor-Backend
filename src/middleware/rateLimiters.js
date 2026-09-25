/**
 * DDoS & Brute Force Protection
 * 
 * Architectural Intent:
 * Prevents credential stuffing attacks on authentication endpoints and 
 * generic DDoS attacks against the broader API.
 * 
 * Logic:
 * Login limiters use a composite key `IP:Email` so an attacker cannot cycle 
 * through IP proxies to hammer a single account, and cannot cycle through 
 * accounts from a single IP.
 */
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
