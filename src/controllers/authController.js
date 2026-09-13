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
import { saveBase64Avatar } from "../utils/imageStorage.js";

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

const parseYYYYMMDD = (dateStr) => {
  if (!dateStr || typeof dateStr !== "string") return null;
  const match = dateStr.match(/^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(`${year}-${month}-${day}T00:00:00Z`);
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
    hirerRating: user.profile?.hirerRating ?? user.profile?.rating ?? 0,
    hirerReviews: user.profile?.hirerReviews ?? user.profile?.reviews ?? 0,
    providerRating: user.profile?.providerRating ?? user.profile?.rating ?? 0,
    providerReviews: user.profile?.providerReviews ?? user.profile?.reviews ?? 0,
    completedJobs: user.profile?.completedJobs ?? 0,
    hourlyRate: user.profile?.hourlyRate ?? 0,
    availableNow: !!user.profile?.availableNow,
    workingHours: user.profile?.workingHours || "Flexible",
  },
});

const passwordRules = (password) =>
  typeof password === "string" && password.length >= 8;

export async function register(request, response) {
  try {
    const { name, email, password, nidNumber, dateOfBirth } = request.body;
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
          message: "Invalid registration details. Name, valid email, password (min 8 chars), and role are required.",
        },
      });
    }

    if (!nidNumber || !dateOfBirth) {
      return response.status(400).json({
        success: false,
        error: {
          code: "MISSING_NID_DETAILS",
          message: "National ID (NID) number and Date of Birth are mandatory for account creation.",
        },
      });
    }

    const cleanNid = String(nidNumber || "").trim().replace(/[-\s]/g, "");
    if (!/^\d{10,17}$/.test(cleanNid)) {
      return response.status(400).json({
        success: false,
        error: {
          code: "INVALID_NID_FORMAT",
          message: "NID number must be between 10 and 17 numeric digits.",
        },
      });
    }

    const parsedDob = parseYYYYMMDD(dateOfBirth);
    if (!parsedDob) {
      return response.status(422).json({
        success: false,
        error: {
          code: "INVALID_DOB_FORMAT",
          message: "Please select a valid Date of Birth.",
        },
      });
    }

    // Explicit pre-save check to ensure NID uniqueness
    const nidExists = await User.exists({ nidNumber: cleanNid });
    if (nidExists) {
      return response.status(409).json({
        success: false,
        error: {
          code: "NID_EXISTS",
          message: "An account with this NID already exists.",
        },
      });
    }

    // Mandatory NID verification before account creation
    const nidResult = await verifyNID({
      nidNumber: cleanNid,
      dateOfBirth: parsedDob,
      name: String(name).trim(),
    });

    if (!nidResult.verified) {
      return response.status(422).json({
        success: false,
        error: {
          code: "NID_VERIFICATION_FAILED",
          message:
            nidResult.reason ||
            "NID verification failed. Please ensure your NID number, Full Name, and Date of Birth match official records.",
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
      nidNumber: cleanNid,
      dateOfBirth: parsedDob,
      nidVerified: true,
      nidSubmittedAt: new Date(),
      profile: {
        category: "General Service",
        hourlyRate: 0,
        availableNow: true,
        skills: [],
        bio: "",
      },
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
    if (error.code === 11000 || error.message?.includes("E11000")) {
      const isNid =
        error.message?.includes("nidNumber") ||
        JSON.stringify(error.keyValue || {}).includes("nidNumber");
      if (isNid) {
        return response.status(409).json({
          success: false,
          error: {
            code: "NID_EXISTS",
            message: "An account with this NID already exists.",
          },
        });
      }
      return response.status(409).json({
        success: false,
        error: {
          code: "EMAIL_EXISTS",
          message: "An account with this email already exists.",
        },
      });
    }
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
  if (!request.user) {
    return response.json({ user: null });
  }
  response.json({ user: publicUser(request.user) });
}

export async function switchMode(request, response) {
  try {
    const { mode, activeMode } = request.body;
    const targetMode = mode || activeMode;
    const normalizedMode = normalizeRole(targetMode);

    if (!["HIRER", "SERVICE_PROVIDER"].includes(normalizedMode)) {
      return response.status(400).json({
        success: false,
        error: { code: "INVALID_MODE", message: "Invalid role mode specified" },
      });
    }

    // Automatically ensure availableModes includes both roles for smooth switching
    if (
      !Array.isArray(request.user.availableModes) ||
      request.user.availableModes.length < 2
    ) {
      request.user.availableModes = ["HIRER", "SERVICE_PROVIDER"];
    }

    request.user.activeMode = normalizedMode;
    await request.user.save();

    return response.json({
      success: true,
      user: publicUser(request.user),
    });
  } catch (error) {
    console.error("switchMode error:", error);
    return response.status(500).json({
      success: false,
      error: { code: "SWITCH_MODE_FAILED", message: "Failed to switch mode" },
    });
  }
}

export async function uploadAvatar(request, response) {
  try {
    const { avatar } = request.body;
    if (!avatar || typeof avatar !== "string") {
      return response.status(400).json({
        success: false,
        error: { code: "INVALID_IMAGE", message: "Image data is required" },
      });
    }

    const savedPath = saveBase64Avatar(avatar, request.user.id);
    if (!savedPath) {
      return response.status(400).json({
        success: false,
        error: { code: "UPLOAD_FAILED", message: "Failed to process image file" },
      });
    }

    request.user.avatar = savedPath;
    await request.user.save();

    return response.json({
      success: true,
      avatar: savedPath,
      user: publicUser(request.user),
    });
  } catch (error) {
    console.error("uploadAvatar error:", error);
    return response.status(500).json({
      success: false,
      error: {
        code: "UPLOAD_FAILED",
        message: "Failed to upload profile picture",
      },
    });
  }
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
      workingHours,
      availableNow,
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

    if (typeof password === "string" && password.trim() && !passwordRules(password)) {
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
    
    // Handle persistent avatar storage if base64 or path provided
    if (typeof avatar === "string" && avatar.trim()) {
      const trimmedAvatar = avatar.trim();
      if (trimmedAvatar.startsWith("data:image/")) {
        const savedPath = saveBase64Avatar(trimmedAvatar, user.id);
        if (savedPath) user.avatar = savedPath;
      } else {
        user.avatar = trimmedAvatar;
      }
    }

    if (typeof activeMode === "string" && activeMode.trim()) {
      const normalizedMode = normalizeRole(activeMode);
      if (["HIRER", "SERVICE_PROVIDER"].includes(normalizedMode)) {
        user.activeMode = normalizedMode;
        if (
          !Array.isArray(user.availableModes) ||
          user.availableModes.length < 2
        ) {
          user.availableModes = ["HIRER", "SERVICE_PROVIDER"];
        }
      }
    }

    const profile = user.profile || {};
    if (typeof category === "string") profile.category = category.trim();
    if (typeof hourlyRate !== "undefined")
      profile.hourlyRate = Number(hourlyRate) || 0;
    if (typeof bio === "string") profile.bio = bio.trim();
    if (typeof workingHours === "string")
      profile.workingHours = workingHours.trim();
    if (typeof availableNow !== "undefined")
      profile.availableNow = Boolean(availableNow);
    if (typeof skills !== "undefined") {
      profile.skills = Array.isArray(skills)
        ? skills
            .filter(Boolean)
            .map((skill) => String(skill).trim())
            .slice(0, 12)
        : typeof skills === "string"
          ? skills
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
              .slice(0, 12)
          : [];
    }
    if (typeof location === "string") profile.district = location.trim();
    user.profile = profile;

    if (typeof password === "string" && password.trim() && passwordRules(password)) {
      user.passwordHash = await bcrypt.hash(password, 12);
      user.refreshTokens = [];
    }

    await user.save();
    return response.json({ success: true, user: publicUser(user) });
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
  try {
    const { nidNumber, dateOfBirth } = request.body;
    const cleanNid = String(nidNumber || "").trim().replace(/[-\s]/g, "");

    if (!cleanNid || !/^\d{10,17}$/.test(cleanNid)) {
      return response.status(400).json({
        success: false,
        error: {
          code: "INVALID_NID_FORMAT",
          message: "NID number must be between 10 and 17 numeric digits.",
        },
      });
    }

    const parsedDob = parseYYYYMMDD(dateOfBirth);
    if (!parsedDob) {
      return response.status(422).json({
        success: false,
        error: {
          code: "INVALID_DOB_FORMAT",
          message: "Please select a valid Date of Birth.",
        },
      });
    }

    const duplicate = await User.exists({
      nidNumber: cleanNid,
      _id: { $ne: request.user.id },
    });
    if (duplicate) {
      return response.status(409).json({
        success: false,
        error: {
          code: "NID_EXISTS",
          message: "An account with this NID already exists.",
        },
      });
    }

    const result = await verifyNID({
      nidNumber: cleanNid,
      dateOfBirth: parsedDob,
      name: request.user.name,
    });
    request.user.nidNumber = cleanNid;
    request.user.dateOfBirth = parsedDob;
    request.user.nidSubmittedAt = new Date();
    request.user.nidVerified = result.verified;
    await request.user.save();
    return response
      .status(result.verified ? 200 : 422)
      .json({ verified: result.verified, reason: result.reason, user: publicUser(request.user) });
  } catch (error) {
    if (error.code === 11000) {
      return response.status(409).json({
        success: false,
        error: {
          code: "NID_EXISTS",
          message: "An account with this NID already exists.",
        },
      });
    }
    console.error("submitNid error:", error);
    return response.status(500).json({
      success: false,
      error: { code: "NID_VERIFICATION_FAILED", message: "Failed to verify NID details." },
    });
  }
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

export async function changePassword(request, response) {
  try {
    const { currentPassword, newPassword } = request.body;

    if (!currentPassword || !newPassword) {
      return response.status(400).json({
        success: false,
        error: { code: "MISSING_FIELDS", message: "Current password and new password are required" },
      });
    }

    if (!passwordRules(newPassword)) {
      return response.status(400).json({
        success: false,
        error: { code: "WEAK_PASSWORD", message: "New password must be at least 8 characters long" },
      });
    }

    // Re-fetch user with passwordHash for comparison
    const user = await User.findById(request.user.id).select("+passwordHash");
    if (!user) {
      return response.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "User not found" } });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return response.status(401).json({
        success: false,
        error: { code: "WRONG_PASSWORD", message: "Current password is incorrect" },
      });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    // Invalidate all refresh tokens so other sessions are forced to re-authenticate
    user.refreshTokens = [];
    await user.save();

    // Issue fresh tokens for the current session
    const tokens = issueUserTokens(user);
    user.refreshTokens.push({
      tokenId: tokens.tokenId,
      tokenHash: await hashToken(tokens.refreshToken),
      expiresAt: tokens.expiresAt,
    });
    await user.save();
    setUserCookies(response, tokens.accessToken, tokens.refreshToken);

    return response.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("changePassword error:", error);
    return response.status(500).json({
      success: false,
      error: { code: "UPDATE_FAILED", message: "Failed to update password. Please try again." },
    });
  }
}

export async function getPublicUser(request, response) {
  try {
    const { userId } = request.params;
    const user = await User.findById(userId).select(
      "name avatar nidVerified profile location createdAt role activeMode",
    );
    if (!user) {
      return response.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "User not found" } });
    }

    return response.json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        avatar: user.avatar || "",
        nidVerified: !!user.nidVerified,
        memberSince: user.createdAt,
        location: user.location || user.profile?.district || "",
        activeMode: user.activeMode || user.role,
        profile: {
          bio: user.profile?.bio || "",
          category: user.profile?.category || "",
          skills: user.profile?.skills || [],
          rating: user.profile?.providerRating ?? user.profile?.rating ?? 0,
          reviews: user.profile?.providerReviews ?? user.profile?.reviews ?? 0,
          hirerRating: user.profile?.hirerRating ?? 0,
          hirerReviews: user.profile?.hirerReviews ?? 0,
          completedJobs: user.profile?.completedJobs ?? 0,
        },
      },
    });
  } catch (error) {
    console.error("getPublicUser error:", error);
    return response.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Failed to fetch user profile" } });
  }
}

