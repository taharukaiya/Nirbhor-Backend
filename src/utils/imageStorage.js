import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "avatars");

/**
 * Ensures that the uploads directory exists.
 */
export function ensureUploadDirExists() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

/**
 * Saves base64 image data to the avatars directory on disk.
 * @param {string} base64Data Data URL or base64 string
 * @param {string} userId User ID prefix
 * @returns {string|null} Relative static URL path (e.g. /uploads/avatars/avatar-xxx.png)
 */
export function saveBase64Avatar(base64Data, userId) {
  if (!base64Data || typeof base64Data !== "string") return null;
  
  // If it's already a URL path (e.g. /uploads/avatars/...), return as-is
  if (base64Data.startsWith("/uploads/") || base64Data.startsWith("http://") || base64Data.startsWith("https://")) {
    return base64Data;
  }

  try {
    ensureUploadDirExists();
    
    // Extract format and raw base64 buffer
    const matches = base64Data.match(/^data:image\/([a-zA-Z0-9+.=-]+);base64,(.+)$/);
    let extension = "png";
    let buffer;

    if (matches && matches.length === 3) {
      extension = matches[1] === "jpeg" ? "jpg" : matches[1];
      buffer = Buffer.from(matches[2], "base64");
    } else {
      // Fallback: raw base64 string
      buffer = Buffer.from(base64Data, "base64");
    }

    const filename = `avatar-${userId || "user"}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${extension}`;
    const filePath = path.join(UPLOADS_DIR, filename);
    
    fs.writeFileSync(filePath, buffer);
    return `/uploads/avatars/${filename}`;
  } catch (error) {
    console.error("Failed to save avatar image to disk:", error);
    return null;
  }
}
