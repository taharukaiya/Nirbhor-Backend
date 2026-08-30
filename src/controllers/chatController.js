import { Job } from "../models/Job.js";
import { Proposal } from "../models/Proposal.js";
import { JobChat } from "../models/JobChat.js";
import { maskContactInfo } from "../utils/contactFilter.js";

async function authorizedChat(jobId, proposalId, userId) {
  const proposal = await Proposal.findOne({
    _id: proposalId,
    job: jobId,
  }).lean();
  if (!proposal) return null;
  const job = await Job.findOne({
    _id: jobId,
    $or: [{ hirer: userId }, { _id: jobId }],
  }).lean();
  if (
    !job ||
    (job.hirer.toString() !== userId && proposal.provider.toString() !== userId)
  )
    return null;
  return { job, proposal };
}

export async function getChat(request, response) {
  const auth = await authorizedChat(
    request.params.jobId,
    request.params.proposalId,
    request.user.id,
  );
  if (!auth) return response.status(404).json({ error: "Chat not found" });
  const chat = await JobChat.findOne({
    job: auth.job.id,
    proposal: auth.proposal.id,
  })
    .populate("messages.sender", "name")
    .lean();
  if (!chat)
    return response.json({
      success: true,
      data: { chat: null, messages: [], nextCursor: null },
      error: null,
    });
  const limit = Math.min(Math.max(Number(request.query.limit) || 30, 1), 100);
  const before = request.query.before
    ? new Date(request.query.before)
    : new Date("9999-12-31");
  const messages = chat.messages
    .filter((message) => message.createdAt < before)
    .slice(-limit);
  response.json({
    success: true,
    data: {
      chat: { ...chat, messages },
      nextCursor:
        messages.length === limit ? messages[0].createdAt.toISOString() : null,
    },
    error: null,
  });
}

export async function createChat(request, response) {
  const auth = await authorizedChat(
    request.params.jobId,
    request.params.proposalId,
    request.user.id,
  );
  if (!auth) return response.status(404).json({ error: "Chat not found" });
  const chat = await JobChat.findOneAndUpdate(
    { job: auth.job.id, proposal: auth.proposal.id },
    {
      $setOnInsert: {
        participants: [auth.job.hirer, auth.proposal.provider],
        job: auth.job.id,
        proposal: auth.proposal.id,
      },
    },
    { upsert: true, new: true },
  );
  response.status(201).json({ chat });
}

export async function addMessage(request, response) {
  const auth = await authorizedChat(
    request.params.jobId,
    request.params.proposalId,
    request.user.id,
  );
  if (!auth) return response.status(404).json({ error: "Chat not found" });
  const chat = await JobChat.findOne({
    job: auth.job.id,
    proposal: auth.proposal.id,
  });
  if (!chat || chat.isArchived)
    return response.status(409).json({ error: "Chat is archived" });
  chat.messages.push({
    sender: request.user.id,
    body: maskContactInfo(request.body.body),
  });
  await chat.save();
  response.status(201).json({ message: chat.messages.at(-1) });
}

export async function markChatRead(request, response) {
  const auth = await authorizedChat(
    request.params.jobId,
    request.params.proposalId,
    request.user.id,
  );
  if (!auth) return response.status(404).json({ error: "Chat not found" });
  const chat = await JobChat.findOne({
    job: auth.job.id,
    proposal: auth.proposal.id,
    participants: request.user.id,
  });
  if (!chat) return response.status(404).json({ error: "Chat not found" });
  const readAt = new Date();
  for (const message of chat.messages)
    if (message.sender.toString() !== request.user.id) message.readAt = readAt;
  await chat.save();
  response.json({ success: true, data: { readAt }, error: null });
}
