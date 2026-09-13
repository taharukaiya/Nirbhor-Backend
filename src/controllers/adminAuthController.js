import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Admin } from "../models/Admin.js";
import { config } from "../config.js";
import { clearAdminCookies, setAdminCookies } from "../utils/cookies.js";
import { compareToken, hashToken, issueAdminTokens } from "../utils/tokens.js";

const publicAdmin = (admin) => ({
  id: admin.id || admin._id?.toString(),
  name: admin.name || "Admin",
  email: admin.email,
  role: admin.role,
  permissions: admin.permissions || {},
});

export async function getAdminSession(request, response) {
  try {
    const raw = request.cookies.admin_access_token || "";
    let payload;

    try {
      payload = jwt.verify(raw, config.accessSecret, { algorithms: ["HS256"] });
    } catch {
      // Access token expired or missing, attempt refresh token auto-renewal
      const refreshRaw = request.cookies.admin_refresh_token || "";
      if (!refreshRaw) return response.json({ admin: null });

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
        return response.json({ admin: null });
      }

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
      return response.json({ admin: publicAdmin(admin) });
    }

    if (
      !["ADMIN", "SUPER_ADMIN", "SUPERADMIN"].includes(payload.accountType) ||
      typeof payload.userId !== "string"
    ) {
      return response.json({ admin: null });
    }

    const admin = await Admin.findById(payload.userId);
    if (!admin || admin.suspended) return response.json({ admin: null });
    return response.json({ admin: publicAdmin(admin) });
  } catch {
    return response.json({ admin: null });
  }
}

export async function loginAdmin(request, response) {
  const admin = await Admin.findOne({
    email: String(request.body.email || "")
      .trim()
      .toLowerCase(),
  }).select("+passwordHash");
  if (
    !admin ||
    admin.suspended ||
    !(await bcrypt.compare(request.body.password || "", admin.passwordHash))
  )
    return response.status(401).json({ error: "Invalid email or password" });
  const tokens = issueAdminTokens(admin);
  admin.refreshTokens.push({
    tokenId: tokens.tokenId,
    tokenHash: await hashToken(tokens.refreshToken),
    expiresAt: tokens.expiresAt,
  });
  await admin.save();
  setAdminCookies(response, tokens.accessToken, tokens.refreshToken);
  response.json({ admin: publicAdmin(admin) });
}

export async function refreshAdmin(request, response) {
  try {
    const raw = request.cookies.admin_refresh_token || "";
    const payload = jwt.verify(raw, config.refreshSecret, {
      algorithms: ["HS256"],
    });
    const admin = await Admin.findById(payload.userId);
    const stored = admin?.refreshTokens.find(
      (item) => item.tokenId === payload.tokenId,
    );
    if (
      !admin ||
      !stored ||
      stored.expiresAt < new Date() ||
      !(await compareToken(raw, stored.tokenHash))
    )
      return response.status(401).json({ error: "Unauthorized" });
    const tokens = issueAdminTokens(admin);
    admin.refreshTokens = admin.refreshTokens.filter(
      (item) => item.tokenId !== payload.tokenId,
    );
    admin.refreshTokens.push({
      tokenId: tokens.tokenId,
      tokenHash: await hashToken(tokens.refreshToken),
      expiresAt: tokens.expiresAt,
    });
    await admin.save();
    setAdminCookies(response, tokens.accessToken, tokens.refreshToken);
    response.json({ admin: publicAdmin(admin) });
  } catch {
    response.status(401).json({ error: "Unauthorized" });
  }
}

export async function logoutAdmin(request, response) {
  try {
    const payload = jwt.verify(
      request.cookies.admin_refresh_token || "",
      config.refreshSecret,
      { algorithms: ["HS256"] },
    );
    await Admin.updateOne(
      { _id: payload.userId },
      { $pull: { refreshTokens: { tokenId: payload.tokenId } } },
    );
  } catch {
    /* idempotent logout */
  }
  clearAdminCookies(response);
  response.status(204).send();
}
