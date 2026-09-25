/**
 * Virtual Wallet Controller
 * 
 * Architectural Intent:
 * Manages the user's internal wallet balance, aggregating deposits, 
 * withdrawals, and escrow transfers into a unified ledger.
 * 
 * Integrity:
 * - `requestWithdrawal`: Uses MongoDB Sessions and Transactions to safely 
 *   deduct the user's wallet balance and create a Withdrawal record atomically, 
 *   preventing race conditions or negative balances.
 */
import { User } from "../models/User.js";
import { EscrowPayment } from "../models/EscrowPayment.js";
import { WalletDeposit } from "../models/WalletDeposit.js";
import { createPaymentSession } from "../services/PaymentService.js";
import crypto from "node:crypto";

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

  const withdrawals = await import("../models/Withdrawal.js").then(m => m.Withdrawal.find({ provider: user.id }).lean());
  
  const withdrawalLedger = withdrawals.map(w => ({
      id: w._id,
      type: "DEBIT",
      amount: w.amount,
      desc: `Withdrawal via ${w.method}`,
      date: w.createdAt,
      status: w.status,
  }));

  const deposits = await WalletDeposit.find({ user: user.id }).lean();
  const depositLedger = deposits.map(d => ({
    id: d._id,
    type: "CREDIT",
    amount: d.amount,
    desc: `Wallet Deposit (SSLCommerz) - ${d.status}`,
    date: d.createdAt,
    status: d.status,
  }));

  const combinedLedger = [...ledger, ...withdrawalLedger, ...depositLedger].sort((a, b) => new Date(b.date) - new Date(a.date));

  response.json({
    balance: user.walletBalance,
    ledger: combinedLedger,
  });
}

export async function initiateDeposit(request, response) {
  try {
    const { amount } = request.body;
    if (!amount || amount <= 0) {
      return response.status(400).json({ error: "Invalid deposit amount" });
    }

    const transactionId = "DEP_" + crypto.randomUUID();
    const deposit = await WalletDeposit.create({
      user: request.user.id,
      amount: amount,
      gatewayTransactionId: transactionId,
      status: "PENDING",
    });

    const gateway = await createPaymentSession({
      paymentId: transactionId,
      amount: amount,
      customer: request.user,
    });

    response.status(201).json({
      depositId: deposit.id,
      gatewayPageUrl: gateway.GatewayPageURL,
    });
  } catch (error) {
    console.error("initiateDeposit error:", error);
    response.status(500).json({ error: error.message || "Failed to initiate deposit" });
  }
}


export async function requestWithdrawal(request, response) {
  const mongoose = await import("mongoose");
  const dbSession = await mongoose.startSession();
  try {
    const { amount, method, accountDetails } = request.body;
    
    if (!amount || amount <= 0) {
      return response.status(400).json({ error: "Invalid withdrawal amount" });
    }

    let withdrawalDoc = null;
    await dbSession.withTransaction(async () => {
      const user = await User.findById(request.user.id).session(dbSession);
      if (!user) throw Object.assign(new Error("User not found"), { statusCode: 404 });

      if ((user.walletBalance || 0) < amount) {
        throw Object.assign(new Error("Insufficient balance"), { statusCode: 400 });
      }

      user.walletBalance -= amount;
      await user.save({ session: dbSession });

      const { Withdrawal } = await import("../models/Withdrawal.js");
      const docs = await Withdrawal.create([{
        provider: user.id,
        amount,
        method,
        accountDetails,
        status: "PENDING"
      }], { session: dbSession });
      withdrawalDoc = docs[0];
    });

    response.status(201).json({ message: "Withdrawal requested successfully", withdrawal: withdrawalDoc });
  } catch (error) {
    console.error("requestWithdrawal error:", error);
    const code = error.statusCode || 500;
    response.status(code).json({ error: error.message || "Failed to process withdrawal" });
  } finally {
    await dbSession.endSession();
  }
}
