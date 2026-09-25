/**
 * MockNID Model
 * 
 * Architectural Intent:
 * A localized sandbox database simulating a government National ID (NID) API registry.
 * During KYC (Know Your Customer) verification, the platform queries this collection 
 * instead of a real external API to validate provider identities for the demo/beta environment.
 */
import mongoose from "mongoose";

const mockNidSchema = new mongoose.Schema(
  {
    nidNumber: { type: String, required: true, unique: true, trim: true },
    dateOfBirth: { type: Date, required: true },
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Ensures fast lookup and prevents duplicate seeding of the same NID + DOB combo
mockNidSchema.index({ nidNumber: 1, dateOfBirth: 1 }, { unique: true });

export const MockNID = mongoose.model("MockNID", mockNidSchema);
