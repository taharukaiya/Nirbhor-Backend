import { Proposal } from "../models/Proposal.js";

export async function getProviderProposals(request, response) {
  try {
    const userRole = request.user.activeMode || request.user.role;
    if (userRole !== "SERVICE_PROVIDER") {
      return response.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Only Service Providers can access this endpoint.",
        },
      });
    }

    const proposals = await Proposal.find({ provider: request.user.id })
      .populate("job", "title description category location budget status deadline createdAt")
      .sort({ createdAt: -1 })
      .lean();

    let acceptedCount = 0;
    let pendingCount = 0;
    let rejectedCount = 0;
    let completedCount = 0;

    const formattedProposals = proposals.map((p) => {
      if (p.status === "ACCEPTED") acceptedCount++;
      else if (p.status === "PENDING") pendingCount++;
      else if (p.status === "REJECTED") rejectedCount++;
      else if (p.status === "COMPLETED") completedCount++;

      return {
        proposalId: p._id.toString(),
        job: p.job,
        status: p.status,
        amount: p.amount,
        message: p.message,
        appliedAt: p.createdAt,
      };
    });

    return response.json({
      success: true,
      metrics: {
        totalApplied: proposals.length,
        accepted: acceptedCount,
        pending: pendingCount,
        rejected: rejectedCount,
        completed: completedCount,
      },
      proposals: formattedProposals,
    });
  } catch (error) {
    console.error("getProviderProposals error:", error);
    return response.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to fetch proposals" },
    });
  }
}
