import { User } from "../models/User.js";

export async function listServices(request, response) {
  const query = {
    role: "SERVICE_PROVIDER",
    suspended: false,
    ...(request.query.district
      ? { "profile.district": request.query.district }
      : {}),
  };
  if (request.query.q) query.$text = { $search: request.query.q };
  const providers = await User.find(query)
    .select("name role emailVerified nidVerified activeMode profile")
    .sort({ nidVerified: -1, updatedAt: -1 })
    .limit(100)
    .lean();
  response.json({
    services: providers.map((provider) => ({
      id: provider._id,
      name: provider.name,
      category: provider.profile?.category || "Service Provider",
      location: provider.profile?.district || "Bangladesh",
      district: provider.profile?.district || "",
      rating: provider.profile?.rating || 0,
      reviews: provider.profile?.reviews || 0,
      completedJobs: provider.profile?.completedJobs || 0,
      hourlyRate: provider.profile?.hourlyRate || 0,
      verified: provider.nidVerified,
      availableNow: provider.profile?.availableNow || false,
      bio: provider.profile?.bio || "",
      skills: provider.profile?.skills || [],
      initials: provider.name
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      color: "#2e7df6",
    })),
  });
}
