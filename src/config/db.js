/**
 * Database Connection & Bootstrap Manager
 * 
 * Architectural Intent:
 * Manages the lifecycle of the MongoDB connection using Mongoose. 
 * Includes a robust fallback mechanism to attempt remote connections first, then local, 
 * alongside automatic bootstrapping of the root `SUPER_ADMIN` to ensure the platform 
 * is always accessible by a master account upon fresh deployment.
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { config } from "../config.js";
import { Admin } from "../models/Admin.js";

/**
 * Super Admin Bootstrapper
 * 
 * Business Logic:
 * On server startup, we verify if a SUPER_ADMIN role exists. If the database is completely empty 
 * (e.g., first deployment), this function injects a hardcoded master admin.
 * This guarantees that the system administrators can always log in to the admin panel to begin 
 * configuring the platform, promoting other admins, and managing users without needing manual DB inserts.
 */
export async function ensureSuperAdminSeeded() {
  try {
    const existing = await Admin.findOne({ role: "SUPER_ADMIN" });
    if (!existing) {
      const email = "superadmin@nirbhor.com";
      const password = "SuperAdmin@Nirbhor2026";
      const passwordHash = await bcrypt.hash(password, 12);
      
      // Inject the root administrator with all system permissions granted
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

/**
 * Robust Database Connector
 * 
 * Edge Case Handling:
 * Network blips or remote DB downtime can crash the server on boot. This function implements 
 * a fallback array (`uris`). It attempts to connect to the configured `MONGO_URI`. If that fails,
 * it retries. If the primary URI completely fails, it falls back to a local instance to ensure
 * development environments don't break if cloud credentials rotate.
 */
export async function connectDatabase() {
  let lastError;
  // Deduplicate URIs to prevent redundant connection attempts if remote == local
  const uris = [config.mongoUri, "mongodb://127.0.0.1:27017/nirbhor"].filter(
    (u, index, self) => u && self.indexOf(u) === index,
  );

  for (const uri of uris) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        console.log(`[DB] Connecting to MongoDB (${uri.includes("127.0.0.1") ? "local" : "remote"})...`);
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
        
        // Ensure RBAC (Role-Based Access Control) root exists only after successful DB connection
        await ensureSuperAdminSeeded();
        
        console.log(`[DB] Connected successfully to ${uri.includes("127.0.0.1") ? "local" : "remote"} MongoDB.`);
        return;
      } catch (error) {
        lastError = error;
        console.warn(`[DB] Connection attempt ${attempt} failed:`, error.message);
        // Throttle retries to prevent hammering the database server during restart loops
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }
  // Hard crash if no database is available, as the backend cannot function statelessly
  throw lastError;
}
