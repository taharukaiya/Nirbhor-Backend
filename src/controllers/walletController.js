import { User } from "../models/User.js";
import { EscrowPayment } from "../models/EscrowPayment.js";

export async function getWalletData(request, response) {
  const user = await User.findById(request.user.id).select("walletBalance");
  if (!user) return response.status(404).json({ error: "User not found" });

  const transactions = await EscrowPayment.find({
    $or: [{ hirer: user.id }, { provider: user.id }],
  })
    .populate("job", "title")
    .sort({ createdAt: -1 })
    .lean();

  const ledger = transactions.map((t) => {
    let type = "";
    let amount = 0;
    let desc = "";
    if (t.hirer.toString() === user.id) {
      type = "DEBIT";
      amount = -t.amount;
      desc = `Payment for job: ${t.job?.title || "Unknown"}`;
    } else if (t.provider.toString() === user.id) {
      if (t.status === "RELEASED") {
        type = "CREDIT";
        amount = t.providerNetPayout;
        desc = `Earned from job: ${t.job?.title || "Unknown"}`;
      } else {
        type = "PENDING";
        amount = t.providerNetPayout;
        desc = `Escrow pending for job: ${t.job?.title || "Unknown"}`;
      }
    }
    return {
      id: t._id,
      type,
      amount,
      desc,
      date: t.releasedAt || t.createdAt,
      status: t.status,
    };
  });

  response.json({
    balance: user.walletBalance,
    ledger,
  });
}
