import { User } from "../models/User.js";

const toProviderShape = (provider) => ({
  id: provider._id.toString(),
  name: provider.name,
  avatar: provider.avatar || "",
  category: provider.profile?.category || "Service Provider",
  location: provider.location?.fullAddress || provider.location?.district || "Bangladesh",
  division: provider.location?.division || "",
  district: provider.location?.district || "",
  rating: provider.profile?.rating || 0,
  reviews: provider.profile?.reviews || 0,
  completedJobs: provider.profile?.completedJobs || 0,
  hourlyRate: provider.profile?.hourlyRate || 0,
  workingHours: provider.profile?.workingHours || "Flexible",
  verified: !!provider.nidVerified,
  availableNow: !!provider.profile?.availableNow,
  bio: provider.profile?.bio || "",
  skills: provider.profile?.skills || [],
  phone: provider.phone || "",
  email: provider.email || "",
  initials: (provider.name || "Provider")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase(),
  color: "#2e7df6",
});

export async function listServices(request, response) {
  const query = {
    availableModes: "SERVICE_PROVIDER",
    suspended: false,
  };

  if (request.query.division) {
    query["location.division"] = request.query.division;
  }
  
  if (request.query.category) {
    query["profile.category"] = request.query.category;
  }

  if (request.query.q) {
    const searchRegex = new RegExp(request.query.q.trim(), "i");
    query.$or = [
      { name: searchRegex },
      { "profile.category": searchRegex },
      { "profile.skills": searchRegex },
      { "profile.bio": searchRegex },
      { "location.district": searchRegex },
    ];
  }

  const providers = await User.find(query)
    .select("name role emailVerified nidVerified activeMode profile avatar phone location email")
    .sort({ nidVerified: -1, updatedAt: -1 })
    .limit(100)
    .lean();

  response.json({
    services: providers.map(toProviderShape),
  });
}

export async function getServiceProvider(request, response) {
  const provider = await User.findById(request.params.id)
    .select("name role emailVerified nidVerified activeMode profile avatar phone location email")
    .lean();

  if (!provider || provider.suspended) {
    return response.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Service provider profile not found" },
    });
  }

  response.json({
    success: true,
    provider: toProviderShape(provider),
  });
}
