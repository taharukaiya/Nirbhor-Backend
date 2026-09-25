/**
 * Authentication Middleware
 * 
 * Architectural Intent:
 * Secures the application by implementing stateless Access Token verification 
 * with a stateful Refresh Token fallback mechanism.
 * 
 * Flow:
 * 1. Checks `access_token` cookie or `Authorization: Bearer` header.
 * 2. If valid, attaches user/admin to `request` and proceeds.
 * 3. If expired, catches the error and immediately attempts to rotate the session 
 *    using the `refresh_token`.
 * 4. Checks the DB for the hashed refresh token. If valid, issues a new token pair, 
 *    updates the cookies automatically, and allows the request to proceed seamlessly.
 *    (This prevents the frontend from having to handle token rotation).
 */
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { Admin } from "../models/Admin.js";
import { config } from "../config.js";
import { compareToken, hashToken, issueUserTokens } from "../utils/tokens.js";
import { setUserCookies } from "../utils/cookies.js";

export async function authenticate(request, response, next) {
  try {
    let token = request.cookies.access_token;
    if (!token && request.headers.authorization?.startsWith("Bearer ")) {
      token = request.headers.authorization.split(" ")[1];
    }
    let payload;
    try {
      payload = jwt.verify(
        token || "",
        config.accessSecret,
        { algorithms: ["HS256"] },
      );
    } catch {
      // Try refresh token if access_token is expired
      const refreshRaw =
        request.cookies.refresh_token ||
        request.headers["x-refresh-token"] ||
        "";
      if (!refreshRaw) return response.status(401).json({ error: "Unauthorized" });

      const refreshPayload = jwt.verify(refreshRaw, config.refreshSecret, {
        algorithms: ["HS256"],
      });
      const user = await User.findById(refreshPayload.userId);
      const stored = user?.refreshTokens.find(
        (item) => item.tokenId === refreshPayload.tokenId,
      );

      if (
        !user ||
        user.suspended ||
        !stored ||
        stored.expiresAt < new Date() ||
        !(await compareToken(refreshRaw, stored.tokenHash))
      ) {
        return response.status(401).json({ error: "Unauthorized" });
      }

      const tokens = issueUserTokens(user);
      user.refreshTokens = user.refreshTokens.filter(
        (item) => item.tokenId !== refreshPayload.tokenId,
      );
      user.refreshTokens.push({
        tokenId: tokens.tokenId,
        tokenHash: await hashToken(tokens.refreshToken),
        expiresAt: tokens.expiresAt,
      });
      await user.save();
      setUserCookies(response, tokens.accessToken, tokens.refreshToken);
      request.user = user;
      return next();
    }

    if (payload.accountType !== "USER" || typeof payload.userId !== "string")
      return response.status(401).json({ error: "Unauthorized" });
    const user = await User.findById(payload.userId).select("-passwordHash");
    if (!user || user.suspended)
      return response.status(401).json({ error: "Unauthorized" });
    request.user = user;
    next();
  } catch {
    response.status(401).json({ error: "Unauthorized" });
  }
}

export async function optionalAuthenticate(request, response, next) {
  authenticate(request, {
    ...response,
    status: (code) => ({
      json: (data) => {
        if (code === 401) {
          request.user = null;
          return next();
        }
        return response.status(code).json(data);
      }
    })
  }, next);
}

export async function authenticateAdmin(request, response, next) {
  try {
    let token = request.cookies.admin_access_token;
    if (!token && request.headers.authorization?.startsWith("Bearer ")) {
      token = request.headers.authorization.split(" ")[1];
    }
    let payload;
    
    try {
      payload = jwt.verify(
        token || "",
        config.accessSecret,
        { algorithms: ["HS256"] },
      );
    } catch {
      // Access token expired or missing, try admin refresh token
      const refreshRaw =
        request.cookies.admin_refresh_token ||
        request.headers["x-admin-refresh-token"] ||
        "";
      if (!refreshRaw) return response.status(401).json({ error: "Unauthorized" });

      const refreshPayload = jwt.verify(refreshRaw, config.refreshSecret, {
        algorithms: ["HS256"],
      });
      const admin = await Admin.findById(refreshPayload.userId);
      const stored = admin?.refreshTokens.find(
        (item) => item.tokenId === refreshPayload.tokenId,
      );

      if (
        !admin ||
        admin.suspended ||
        !stored ||
        stored.expiresAt < new Date() ||
        !(await compareToken(refreshRaw, stored.tokenHash))
      ) {
        return response.status(401).json({ error: "Unauthorized" });
      }

      // import { issueAdminTokens } from "../utils/tokens.js"; - wait, we need to make sure issueAdminTokens is imported.
      // Let's import it at the top of the file.
      const { issueAdminTokens } = await import("../utils/tokens.js");
      const { setAdminCookies } = await import("../utils/cookies.js");
      
      const tokens = issueAdminTokens(admin);
      admin.refreshTokens = admin.refreshTokens.filter(
        (item) => item.tokenId !== refreshPayload.tokenId,
      );
      admin.refreshTokens.push({
        tokenId: tokens.tokenId,
        tokenHash: await hashToken(tokens.refreshToken),
        expiresAt: tokens.expiresAt,
      });
      await admin.save();
      setAdminCookies(response, tokens.accessToken, tokens.refreshToken);
      request.admin = admin;
      return next();
    }

    if (
      !["ADMIN", "SUPER_ADMIN", "SUPERADMIN"].includes(payload.accountType) ||
      typeof payload.userId !== "string"
    )
      return response.status(401).json({ error: "Unauthorized" });
    const admin = await Admin.findById(payload.userId).select("-passwordHash");
    if (!admin || admin.suspended)
      return response.status(401).json({ error: "Unauthorized" });
    request.admin = admin;
    next();
  } catch {
    response.status(401).json({ error: "Unauthorized" });
  }
}

export async function optionalAuthenticateAdmin(request, response, next) {
  authenticateAdmin(request, {
    ...response,
    status: (code) => ({
      json: (data) => {
        if (code === 401) {
          request.admin = null;
          return next();
        }
        return response.status(code).json(data);
      }
    })
  }, next);
}

export function requireVerifiedNID(request, response, next) {
  if (request.user?.nidVerified !== true)
    return response.status(403).json({ error: "NID verification required" });
  next();
}

export function requireAdmin(request, response, next) {
  if (!["ADMIN", "SUPER_ADMIN"].includes(request.admin?.role))
    return response.status(403).json({ error: "Forbidden" });
  next();
}

export function requireSuperAdmin(request, response, next) {
  if (!["SUPER_ADMIN", "SUPERADMIN"].includes(request.admin?.role))
    return response.status(403).json({ error: "Forbidden" });
  next();
}
