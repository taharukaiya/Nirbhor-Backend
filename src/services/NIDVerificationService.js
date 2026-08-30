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
