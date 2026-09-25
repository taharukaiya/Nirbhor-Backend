/**
 * Category Model
 * 
 * Architectural Intent:
 * Defines the taxonomy of services offered on the platform (e.g., Plumbing, IT, Design).
 * Supports a self-referencing hierarchy via the `parent` field to allow sub-categories.
 */
import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    // URL-friendly identifier used in frontend routing (e.g., /services/home-cleaning)
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Self-referencing field enabling unlimited nesting depth (Parent -> Child -> SubChild)
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
    icon: { type: String, default: "" },
    description: { type: String, default: "" },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

// Compound text index enables rapid searching by name, filtered by active status
categorySchema.index({ name: "text", isActive: 1 });

export const Category = mongoose.model("Category", categorySchema);
