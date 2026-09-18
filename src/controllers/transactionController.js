import { EscrowPayment } from "../models/EscrowPayment.js";
import { WalletDeposit } from "../models/WalletDeposit.js";

// Utility to normalize transactions for the dashboard
function normalizeTransaction(txn, type) {
  if (type === "ESCROW") {
    return {
      id: txn._id,
      date: txn.createdAt,
      type: "ESCROW",
      amount: txn.amount,
      status: txn.status,
      gatewayTransactionId: txn.gatewayTransactionId,
      hirer: txn.hirer,
      provider: txn.provider,
      job: txn.job,
      platformFee: txn.platformFee,
    };
  }
  return {
    id: txn._id,
    date: txn.createdAt,
    type: "DEPOSIT",
    amount: txn.amount,
    status: txn.status,
    gatewayTransactionId: txn.gatewayTransactionId,
    user: txn.user,
  };
}

export async function getUserTransactions(request, response) {
  try {
    const userId = request.user.id;
    const { startDate, endDate, status, type } = request.query;

    const escrowQuery = { $or: [{ hirer: userId }, { provider: userId }] };
    const depositQuery = { user: userId };

    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);
      escrowQuery.createdAt = dateFilter;
      depositQuery.createdAt = dateFilter;
    }

    if (status) {
      escrowQuery.status = status;
      depositQuery.status = status;
    }

    let results = [];

    if (!type || type === "ESCROW") {
      const escrows = await EscrowPayment.find(escrowQuery)
        .populate("hirer", "name avatar")
        .populate("provider", "name avatar")
        .populate("job", "title")
        .sort({ createdAt: -1 })
        .lean();
      results = results.concat(escrows.map((e) => normalizeTransaction(e, "ESCROW")));
    }

    if (!type || type === "DEPOSIT") {
      const deposits = await WalletDeposit.find(depositQuery)
        .sort({ createdAt: -1 })
        .lean();
      results = results.concat(deposits.map((d) => normalizeTransaction(d, "DEPOSIT")));
    }

    results.sort((a, b) => b.date - a.date);

    return response.json({ success: true, transactions: results });
  } catch (error) {
    console.error("getUserTransactions error:", error);
    return response.status(500).json({ success: false, error: "Failed to load transactions" });
  }
}

export async function getAdminTransactions(request, response) {
  try {
    const { startDate, endDate, status, type } = request.query;

    const escrowQuery = {};
    const depositQuery = {};

    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);
      escrowQuery.createdAt = dateFilter;
      depositQuery.createdAt = dateFilter;
    }

    if (status) {
      escrowQuery.status = status;
      depositQuery.status = status;
    }

    let results = [];

    if (!type || type === "ESCROW") {
      const escrows = await EscrowPayment.find(escrowQuery)
        .populate("hirer", "name email")
        .populate("provider", "name email")
        .populate("job", "title")
        .sort({ createdAt: -1 })
        .limit(1000)
        .lean();
      results = results.concat(escrows.map((e) => normalizeTransaction(e, "ESCROW")));
    }

    if (!type || type === "DEPOSIT") {
      const deposits = await WalletDeposit.find(depositQuery)
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .limit(1000)
        .lean();
      results = results.concat(deposits.map((d) => normalizeTransaction(d, "DEPOSIT")));
    }

    results.sort((a, b) => b.date - a.date);

    return response.json({ success: true, transactions: results });
  } catch (error) {
    console.error("getAdminTransactions error:", error);
    return response.status(500).json({ success: false, error: "Failed to load admin transactions" });
  }
}

export async function getAdminAnalytics(request, response) {
  try {
    // Generate simple aggregation metrics
    const escrowStats = await EscrowPayment.aggregate([
      { $match: { status: { $in: ["HELD_IN_ESCROW", "RELEASED"] } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" }
          },
          totalAmount: { $sum: "$amount" },
          totalFee: { $sum: "$platformFee" },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
    ]);

    const formattedStats = escrowStats.map(stat => ({
      date: `${stat._id.year}-${String(stat._id.month).padStart(2, '0')}-${String(stat._id.day).padStart(2, '0')}`,
      totalVolume: stat.totalAmount,
      revenue: stat.totalFee,
      transactions: stat.count
    }));

    return response.json({ success: true, analytics: formattedStats });
  } catch (error) {
    console.error("getAdminAnalytics error:", error);
    return response.status(500).json({ success: false, error: "Failed to load analytics" });
  }
}
