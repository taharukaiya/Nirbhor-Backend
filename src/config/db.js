import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { config } from "../config.js";
import { Admin } from "../models/Admin.js";

export async function ensureSuperAdminSeeded() {
  try {
    const existing = await Admin.findOne({ role: "SUPER_ADMIN" });
    if (!existing) {
      const email = "superadmin@nirbhor.com";
      const password = "SuperAdmin@Nirbhor2026";
      const passwordHash = await bcrypt.hash(password, 12);
      await Admin.create({
        email,
        name: "Super Admin",
        passwordHash,
        role: "SUPER_ADMIN",
        permissions: {
          canManageUsers: true,
          canManageJobs: true,
          canHandleDisputes: true,
          canVerifyNID: true,
          canPromoteAdmins: true,
          canViewAuditLogs: true,
          canModerateContent: true,
          canSuspendUsers: true,
        },
      });
      console.log(
        JSON.stringify({
          event: "super_admin_seeded",
          email,
        }),
      );
    }
  } catch (error) {
    console.error("ensureSuperAdminSeeded error:", error);
  }
}

export async function connectDatabase() {
  let lastError;
  const uris = [config.mongoUri, "mongodb://127.0.0.1:27017/nirbhor"].filter(
    (u, index, self) => u && self.indexOf(u) === index,
  );

  for (const uri of uris) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        console.log(`[DB] Connecting to MongoDB (${uri.includes("127.0.0.1") ? "local" : "remote"})...`);
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
        await ensureSuperAdminSeeded();
        console.log(`[DB] Connected successfully to ${uri.includes("127.0.0.1") ? "local" : "remote"} MongoDB.`);
        return;
      } catch (error) {
        lastError = error;
        console.warn(`[DB] Connection attempt ${attempt} failed:`, error.message);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }
  throw lastError;
}
