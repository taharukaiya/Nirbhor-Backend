import crypto from "node:crypto";
import mongoose from "mongoose";
import { Job } from "../models/Job.js";
import { Proposal } from "../models/Proposal.js";
import { EscrowPayment } from "../models/EscrowPayment.js";
import {
  calculateEscrowBreakdown,
  createPaymentSession,
  validatePayment,
} from "../services/PaymentService.js";

export async function initiatePayment(request, response) {
  const job = await Job.findOne({
    _id: request.params.jobId,
    hirer: request.user.id,
    status: "PAYMENT_PENDING",
  });
  if (!job)
    return response
      .status(404)
      .json({ error: "Payment-pending job not found" });
  const proposal = await Proposal.findOne({
    _id: job.acceptedProposal,
    job: job.id,
    status: "ACCEPTED",
  });
  if (!proposal)
    return response.status(409).json({ error: "Accepted proposal not found" });
  const breakdown = calculateEscrowBreakdown(proposal.amount);
  const payment = await EscrowPayment.create({
    ...breakdown,
    job: job.id,
    proposal: proposal.id,
    hirer: job.hirer,
    provider: proposal.provider,
    gatewayTransactionId: crypto.randomUUID(),
  });
  const gateway = await createPaymentSession({
    paymentId: payment.gatewayTransactionId,
    amount: payment.amount,
    customer: request.user,
  });
  response
    .status(201)
    .json({ paymentId: payment.id, gatewayPageUrl: gateway.GatewayPageURL });
}

export async function paymentIpn(request, response) {
  const { tran_id: transactionId, val_id: validationId } = request.body;
  const payment = await EscrowPayment.findOne({
    gatewayTransactionId: transactionId,
  });
  if (!payment) return response.status(404).send("Unknown transaction");
  await validatePayment(validationId, payment.amount);
  const dbSession = await mongoose.startSession();
  try {
    await dbSession.withTransaction(async () => {
      await EscrowPayment.updateOne(
        { _id: payment.id },
        { $set: { status: "HELD_IN_ESCROW" } },
        { session: dbSession },
      );
      await Job.updateOne(
        { _id: payment.job, status: "PAYMENT_PENDING" },
        { $set: { status: "IN_PROGRESS" } },
        { session: dbSession },
      );
    });
  } finally {
    await dbSession.endSession();
  }
  response.json({ received: true });
}

export async function releasePayment(request, response) {
  const dbSession = await mongoose.startSession();
  try {
    await dbSession.withTransaction(async () => {
      const payment = await EscrowPayment.findOne({
        job: request.params.jobId,
        hirer: request.user.id,
        status: "HELD_IN_ESCROW",
      }).session(dbSession);
      if (!payment)
        throw Object.assign(new Error("Escrow payment not found"), {
          statusCode: 404,
        });
      payment.status = "RELEASED";
      payment.releasedAt = new Date();
      await payment.save({ session: dbSession });
      await Job.updateOne(
        { _id: payment.job, hirer: request.user.id, status: "IN_PROGRESS" },
        { $set: { status: "COMPLETED" } },
        { session: dbSession },
      );
    });
    response.json({ message: "Payment released" });
  } finally {
    await dbSession.endSession();
  }
}
