/**
 * Disk Storage Utility
 * 
 * Architectural Intent:
 * Provides local disk storage for user avatars and chat audio blobs.
 * While production deployments (e.g., AWS, GCP) would typically use S3/GCS buckets, 
 * this local implementation keeps the MVP/Practicum project self-contained.
 * 
 * Security:
 * Uses cryptographic random bytes to generate unpredictable filenames, preventing 
 * users from enumerating/scraping other users' files.
 */
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

const AUDIO_DIR = path.join(process.cwd(), "uploads", "audio");

/**
 * Ensures that the audio directory exists.
 */
export function ensureAudioDirExists() {
  if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
  }
}

/**
 * Saves base64 audio data to the audio directory on disk.
 * @param {string} base64Data Data URL or base64 string
 * @param {string} userId User ID prefix
 * @returns {string|null} Relative static URL path
 */
export function saveBase64Audio(base64Data, userId) {
  if (!base64Data || typeof base64Data !== "string") return null;

  try {
    ensureAudioDirExists();
    
    const parts = base64Data.split(",");
    let extension = "webm";
    let buffer;

    if (parts.length === 2) {
      const match = parts[0].match(/data:audio\/([^;]+)/);
      if (match) {
        extension = match[1].split(';')[0];
      }
      buffer = Buffer.from(parts[1], "base64");
    } else {
      buffer = Buffer.from(base64Data, "base64");
    }

    const filename = `audio-${userId || "user"}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${extension}`;
    const filePath = path.join(AUDIO_DIR, filename);
    
    fs.writeFileSync(filePath, buffer);
    return `/uploads/audio/${filename}`;
  } catch (error) {
    console.error("Failed to save audio to disk:", error);
    return null;
  }
}
