import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { config } from "../config.js";
import { clearUserCookies, setUserCookies } from "../utils/cookies.js";
import {
  compareToken,
  hashToken,
  issueUserTokens,
  signEmailToken,
  verifyEmailToken,
} from "../utils/tokens.js";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "../utils/mailer.js";
import { verifyNID } from "../services/NIDVerificationService.js";

const normalizeRole = (role) => {
  const value = String(role ?? "")
    .trim()
    .toUpperCase();
  if (["BUYER", "HIRER"].includes(value)) return "HIRER";
  if (["WORKER", "SERVICE_PROVIDER", "FREELANCER", "PROVIDER"].includes(value))
    return "SERVICE_PROVIDER";
  if (value === "SERVICE-PROVIDER") return "SERVICE_PROVIDER";
  return value === "SERVICE_PROVIDER" ? "SERVICE_PROVIDER" : "HIRER";
};

const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: normalizeRole(user.role),
  emailVerified: !!user.emailVerified,
  nidVerified: !!user.nidVerified,
  activeMode: normalizeRole(user.activeMode),
  availableModes: (user.availableModes || []).map((mode) =>
    normalizeRole(mode),
  ),
  phone: user.phone || "",
  location: user.location || "",
  avatar: user.avatar || "",
  profile: {
    category: user.profile?.category || "",
    district: user.profile?.district || user.location || "",
    bio: user.profile?.bio || "",
    skills: user.profile?.skills || [],
    rating: user.profile?.rating ?? 0,
    reviews: user.profile?.reviews ?? 0,
    completedJobs: user.profile?.completedJobs ?? 0,
    hourlyRate: user.profile?.hourlyRate ?? 0,
    availableNow: !!user.profile?.availableNow,
  },
});

const passwordRules = (password) =>
  typeof password === "string" && password.length >= 8;

export async function register(request, response) {
  const { name, email, password } = request.body;
  const role = normalizeRole(request.body.role);
  if (
    !name ||
    !email ||
    !passwordRules(password) ||
    !["HIRER", "SERVICE_PROVIDER"].includes(role)
  )
    return response.status(400).json({ error: "Invalid registration details" });
  const normalizedEmail = String(email).trim().toLowerCase();
  if (await User.exists({ email: normalizedEmail }))
    return response.status(409).json({ error: "Unable to create account" });
  const user = await User.create({
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(password, 12),
    role,
    activeMode: role,
    availableModes: ["HIRER", "SERVICE_PROVIDER"],
  });
  await sendVerificationEmail(
    user.email,
    signEmailToken(user.id, "verify-email"),
  );
  const tokens = issueUserTokens(user);
  user.refreshTokens.push({
    tokenId: tokens.tokenId,
    tokenHash: await hashToken(tokens.refreshToken),
    expiresAt: tokens.expiresAt,
  });
  await user.save();
  setUserCookies(response, tokens.accessToken, tokens.refreshToken);
  response.status(201).json({ user: publicUser(user) });
}

export async function verifyEmail(request, response) {
  try {
    const payload = verifyEmailToken(request.params.token, "verify-email");
    const user = await User.findById(payload.userId);
    if (!user)
      return response.status(400).json({ error: "Invalid verification link" });
    user.emailVerified = true;
    await user.save();
    response.json({ message: "Email verified" });
  } catch {
    response.status(400).json({ error: "Invalid verification link" });
  }
}

export async function login(request, response) {
  const user = await User.findOne({
    email: String(request.body.email || "")
      .trim()
      .toLowerCase(),
  }).select("+passwordHash");
  if (
    !user ||
    user.suspended ||
    !(await bcrypt.compare(request.body.password || "", user.passwordHash))
  )
    return response.status(401).json({ error: "Invalid email or password" });
  const tokens = issueUserTokens(user);
  user.refreshTokens.push({
    tokenId: tokens.tokenId,
    tokenHash: await hashToken(tokens.refreshToken),
    expiresAt: tokens.expiresAt,
  });
  await user.save();
  setUserCookies(response, tokens.accessToken, tokens.refreshToken);
  response.json({ user: publicUser(user) });
}

export async function refresh(request, response) {
  try {
    const payload = jwt.verify(
      request.cookies.refresh_token || "",
      config.refreshSecret,
      { algorithms: ["HS256"] },
    );
    const user = await User.findById(payload.userId);
    const stored = user?.refreshTokens.find(
      (item) => item.tokenId === payload.tokenId,
    );
    if (
      !user ||
      !stored ||
      stored.expiresAt < new Date() ||
      !(await compareToken(request.cookies.refresh_token, stored.tokenHash))
    )
      return response.status(401).json({ error: "Unauthorized" });
    const tokens = issueUserTokens(user);
    user.refreshTokens = user.refreshTokens.filter(
      (item) => item.tokenId !== payload.tokenId,
    );
    user.refreshTokens.push({
      tokenId: tokens.tokenId,
      tokenHash: await hashToken(tokens.refreshToken),
      expiresAt: tokens.expiresAt,
    });
    await user.save();
    setUserCookies(response, tokens.accessToken, tokens.refreshToken);
    response.json({ user: publicUser(user) });
  } catch {
    response.status(401).json({ error: "Unauthorized" });
  }
}

export async function logout(request, response) {
  try {
    const payload = jwt.verify(
      request.cookies.refresh_token || "",
      config.refreshSecret,
      { algorithms: ["HS256"] },
    );
    await User.updateOne(
      { _id: payload.userId },
      { $pull: { refreshTokens: { tokenId: payload.tokenId } } },
    );
  } catch {
    /* clearing cookies is intentionally idempotent */
  }
  clearUserCookies(response);
  response.status(204).send();
}

export async function logoutAll(request, response) {
  await User.updateOne(
    { _id: request.user.id },
    { $set: { refreshTokens: [] } },
  );
  clearUserCookies(response);
  response.status(204).send();
}

export async function session(request, response) {
  response.json({ user: publicUser(request.user) });
}

export async function switchMode(request, response) {
  const { mode } = request.body;
  const normalizedMode = normalizeRole(mode);
  if (
    !["HIRER", "SERVICE_PROVIDER"].includes(normalizedMode) ||
    !request.user.availableModes.includes(normalizedMode)
  )
    return response
      .status(400)
      .json({ error: "Mode is not available for this account" });
  request.user.activeMode = normalizedMode;
  await request.user.save();
  response.json({ user: publicUser(request.user) });
}

export async function updateProfile(request, response) {
  const {
    name,
    email,
    phone,
    location,
    password,
    avatar,
    category,
    hourlyRate,
    bio,
    skills,
  } = request.body;
  const user = request.user;

  if (typeof name === "string" && name.trim().length < 2)
    return response
      .status(400)
      .json({ error: "Name must be at least 2 characters long" });
  if (
    typeof email === "string" &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  )
    return response
      .status(400)
      .json({ error: "Please provide a valid email address" });
  if (typeof password === "string" && !passwordRules(password))
    return response
      .status(400)
      .json({ error: "Password must be at least 8 characters long" });

  if (typeof name === "string" && name.trim()) user.name = name.trim();
  if (typeof email === "string" && email.trim()) {
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail !== user.email) {
      const duplicate = await User.exists({
        email: normalizedEmail,
        _id: { $ne: user.id },
      });
      if (duplicate)
        return response
          .status(409)
          .json({ error: "That email is already registered" });
      user.email = normalizedEmail;
      user.emailVerified = false;
    }
  }
  if (typeof phone === "string") user.phone = phone.trim();
  if (typeof location === "string") user.location = location.trim();
  if (typeof avatar === "string") user.avatar = avatar.trim();

  const profile = user.profile || {};
  if (typeof category === "string") profile.category = category.trim();
  if (typeof hourlyRate !== "undefined")
    profile.hourlyRate = Number(hourlyRate) || 0;
  if (typeof bio === "string") profile.bio = bio.trim();
  if (typeof skills !== "undefined") {
    profile.skills = Array.isArray(skills)
      ? skills
          .filter(Boolean)
          .map((skill) => String(skill).trim())
          .slice(0, 12)
      : [];
  }
  if (typeof location === "string") profile.district = location.trim();
  user.profile = profile;

  if (typeof password === "string" && passwordRules(password)) {
    user.passwordHash = await bcrypt.hash(password, 12);
    user.refreshTokens = [];
  }

  await user.save();
  response.json({ user: publicUser(user) });
}

export async function submitNid(request, response) {
  const { nidNumber, dateOfBirth } = request.body;
  const result = await verifyNID({
    nidNumber,
    dateOfBirth,
    name: request.user.name,
  });
  request.user.nidNumber = String(nidNumber || "").trim();
  request.user.dateOfBirth = dateOfBirth;
  request.user.nidSubmittedAt = new Date();
  request.user.nidVerified = result.verified;
  await request.user.save();
  response
    .status(result.verified ? 200 : 422)
    .json({ verified: result.verified, reason: result.reason });
}

export async function forgotPassword(request, response) {
  const user = await User.findOne({
    email: String(request.body.email || "")
      .trim()
      .toLowerCase(),
  });
  if (user)
    await sendPasswordResetEmail(
      user.email,
      signEmailToken(user.id, "reset-password"),
    );
  response.json({
    message: "If the account exists, a reset link has been sent",
  });
}

export async function resetPassword(request, response) {
  try {
    const payload = verifyEmailToken(request.params.token, "reset-password");
    if (!passwordRules(request.body.password))
      return response.status(400).json({ error: "Invalid password" });
    const user = await User.findById(payload.userId);
    if (!user)
      return response.status(400).json({ error: "Invalid reset link" });
    user.passwordHash = await bcrypt.hash(request.body.password, 12);
    user.refreshTokens = [];
    await user.save();
    response.json({ message: "Password reset" });
  } catch {
    response.status(400).json({ error: "Invalid reset link" });
  }
}
