/**
 * NID Verification Service
 * 
 * Architectural Intent:
 * Provides a mock implementation of the National Identity (NID) verification pipeline. 
 * In a production environment, this service would integrate with the official Bangladesh 
 * Election Commission API or a licensed 3rd party KYC provider (e.g., Porichoy).
 * 
 * Logic:
 * Checks the submitted NID, DOB, and Name against the `MockNID` collection.
 * Uses exact match logic with basic normalization (trim, lowercase).
 */
import { MockNID } from "../models/MockNID.js";

export async function verifyNID({ nidNumber, dateOfBirth, name }) {
  if (!nidNumber || !dateOfBirth || !name)
    return { verified: false, reason: "Missing NID details" };
  const record = await MockNID.findOne({
    nidNumber: String(nidNumber).trim(),
    dateOfBirth: new Date(dateOfBirth),
    isActive: true,
  }).lean();
  const verified = Boolean(
    record &&
    record.name.trim().toLowerCase() === String(name).trim().toLowerCase(),
  );
  return {
    verified,
    reason: verified ? undefined : "NID details did not match",
  };
}
