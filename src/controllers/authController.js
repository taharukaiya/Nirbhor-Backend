import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
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
  try {
    const { name, email, password } = request.body;
    const role = normalizeRole(request.body.role);

    if (
      !name ||
      !email ||
      !passwordRules(password) ||
      !["HIRER", "SERVICE_PROVIDER"].includes(role)
    ) {
      return response.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "Invalid registration details",
        },
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const exists = await User.exists({ email: normalizedEmail });
    if (exists) {
      return response.status(409).json({
        success: false,
        error: { code: "EMAIL_EXISTS", message: "Email already registered" },
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash,
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
    return response.status(201).json({ user: publicUser(user) });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "register_error",
        message: error.message,
      }),
    );
    return response.status(500).json({
      success: false,
      error: {
        code: "REGISTRATION_FAILED",
        message: "Unable to create account. Please try again.",
      },
    });
  }
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
  try {
    const normalizedEmail = String(request.body.email || "")
      .trim()
      .toLowerCase();
    const password = request.body.password || "";

    if (!normalizedEmail || !password) {
      return response.status(400).json({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Email and password required",
        },
      });
    }

    const user = await User.findOne({ email: normalizedEmail }).select(
      "+passwordHash",
    );

    if (!user || user.suspended) {
      return response.status(401).json({
        success: false,
        error: {
          code: "AUTH_FAILED",
          message: "Invalid email or password",
        },
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return response.status(401).json({
        success: false,
        error: {
          code: "AUTH_FAILED",
          message: "Invalid email or password",
        },
      });
    }

    const tokens = issueUserTokens(user);
    user.refreshTokens.push({
      tokenId: tokens.tokenId,
      tokenHash: await hashToken(tokens.refreshToken),
      expiresAt: tokens.expiresAt,
    });
    await user.save();

    setUserCookies(response, tokens.accessToken, tokens.refreshToken);
    return response.json({ user: publicUser(user) });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "login_error",
        message: error.message,
      }),
    );
    return response.status(500).json({
      success: false,
      error: {
        code: "LOGIN_FAILED",
        message: "Authentication failed. Please try again.",
      },
    });
  }
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
  try {
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
      activeMode,
    } = request.body;
    const user = request.user;

    if (typeof name === "string" && name.trim().length < 2) {
      return response.status(400).json({
        success: false,
        error: {
          code: "INVALID_NAME",
          message: "Name must be at least 2 characters long",
        },
      });
    }

    if (
      typeof email === "string" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      return response.status(400).json({
        success: false,
        error: {
          code: "INVALID_EMAIL",
          message: "Please provide a valid email address",
        },
      });
    }

    if (typeof password === "string" && !passwordRules(password)) {
      return response.status(400).json({
        success: false,
        error: {
          code: "WEAK_PASSWORD",
          message: "Password must be at least 8 characters long",
        },
      });
    }

    if (typeof name === "string" && name.trim()) user.name = name.trim();
    if (typeof email === "string" && email.trim()) {
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail !== user.email) {
        const duplicate = await User.exists({
          email: normalizedEmail,
          _id: { $ne: user.id },
        });
        if (duplicate) {
          return response.status(409).json({
            success: false,
            error: {
              code: "EMAIL_EXISTS",
              message: "That email is already registered",
            },
          });
        }
        user.email = normalizedEmail;
        user.emailVerified = false;
      }
    }

    if (typeof phone === "string") user.phone = phone.trim();
    if (typeof location === "string") user.location = location.trim();
    if (typeof avatar === "string") user.avatar = avatar.trim();

    if (typeof activeMode === "string") {
      const normalizedMode = normalizeRole(activeMode);
      if (["HIRER", "SERVICE_PROVIDER"].includes(normalizedMode)) {
        user.activeMode = normalizedMode;
      }
    }

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
    return response.json({ user: publicUser(user) });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "profile_update_error",
        message: error.message,
      }),
    );
    return response.status(500).json({
      success: false,
      error: {
        code: "UPDATE_FAILED",
        message: "Unable to update profile. Please try again.",
      },
    });
  }
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

/**
 * Google OAuth handler - Sign In or Register
 * Verifies Google ID token and creates/authenticates user
 */
export async function googleOAuth(request, response) {
  try {
    const { idToken, defaultRole } = request.body;

    if (!idToken) {
      return response.status(400).json({
        success: false,
        error: {
          code: "MISSING_TOKEN",
          message: "ID token is required",
        },
      });
    }

    // Verify Google token
    const googleClient = new OAuth2Client(config.googleClientId);
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken,
        audience: config.googleClientId,
      });
    } catch (err) {
      return response.status(401).json({
        success: false,
        error: {
          code: "INVALID_TOKEN",
          message: "Failed to verify Google token",
        },
      });
    }

    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    if (!email) {
      return response.status(400).json({
        success: false,
        error: {
          code: "NO_EMAIL",
          message: "Google account must have an email",
        },
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    let user = await User.findOne({ email: normalizedEmail });

    // If user doesn't exist, create new account
    if (!user) {
      const role = normalizeRole(defaultRole) || "HIRER";
      user = await User.create({
        name: name || "User",
        email: normalizedEmail,
        avatar: picture || "",
        role,
        activeMode: role,
        availableModes: ["HIRER", "SERVICE_PROVIDER"],
        emailVerified: true, // Google emails are verified
        passwordHash: await bcrypt.hash(
          // Generate a random password since OAuth users don't use passwords
          Math.random().toString(36).slice(2),
          12,
        ),
      });
    }

    // Check if user is suspended
    if (user.suspended) {
      return response.status(403).json({
        success: false,
        error: {
          code: "ACCOUNT_SUSPENDED",
          message: "This account has been suspended",
        },
      });
    }

    // Update avatar if Google provides one and user doesn't have one
    if (picture && !user.avatar) {
      user.avatar = picture;
    }

    // Issue tokens
    const tokens = issueUserTokens(user);
    user.refreshTokens.push({
      tokenId: tokens.tokenId,
      tokenHash: await hashToken(tokens.refreshToken),
      expiresAt: tokens.expiresAt,
    });
    await user.save();

    setUserCookies(response, tokens.accessToken, tokens.refreshToken);
    return response.json({
      user: publicUser(user),
      isNewAccount: false, // This will be detected on client if needed
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "google_oauth_error",
        message: error.message,
      }),
    );
    return response.status(500).json({
      success: false,
      error: {
        code: "OAUTH_FAILED",
        message: "Google authentication failed. Please try again.",
      },
    });
  }
}
