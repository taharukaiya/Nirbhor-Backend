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

mockNidSchema.index({ nidNumber: 1, dateOfBirth: 1 }, { unique: true });
export const MockNID = mongoose.model("MockNID", mockNidSchema);
