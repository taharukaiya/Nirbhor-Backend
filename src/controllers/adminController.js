import bcrypt from "bcryptjs";
import { Admin } from "../models/Admin.js";
import { User } from "../models/User.js";
import { Category } from "../models/Category.js";

export async function createAdmin(request, response) {
  const { email, password, role } = request.body;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN")
    return response.status(400).json({ error: "Invalid role" });
  const admin = await Admin.create({
    email: email.trim().toLowerCase(),
    passwordHash: await bcrypt.hash(password, 12),
    role,
  });
  response
    .status(201)
    .json({ admin: { id: admin.id, email: admin.email, role: admin.role } });
}
export async function suspendUser(request, response) {
  const user = await User.findByIdAndUpdate(
    request.params.userId,
    { suspended: true },
    { new: true },
  ).select("-passwordHash");
  if (!user) return response.status(404).json({ error: "User not found" });
  response.json({ user });
}
export async function reviewNid(request, response) {
  const user = await User.findByIdAndUpdate(
    request.params.userId,
    { nidVerified: Boolean(request.body.approved) },
    { new: true },
  ).select("-passwordHash");
  if (!user) return response.status(404).json({ error: "User not found" });
  response.json({ user });
}
export async function createCategory(request, response) {
  const category = await Category.create({
    name: request.body.name,
    slug: request.body.slug,
  });
  response.status(201).json({ category });
}
export async function listCategories(_request, response) {
  response.json({
    categories: await Category.find({ isActive: true })
      .sort({ name: 1 })
      .lean(),
  });
}
