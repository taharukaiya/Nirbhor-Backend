import { Job } from "../models/Job.js";
import { Proposal } from "../models/Proposal.js";
import { JobChat } from "../models/JobChat.js";
import { User } from "../models/User.js";
import { maskContactInfo } from "../utils/contactFilter.js";

async function authorizedChat(jobId, proposalId, userId) {
  if (jobId && proposalId) {
    const proposal = await Proposal.findOne({
      _id: proposalId,
      job: jobId,
    }).lean();
    const job = await Job.findById(jobId).lean();
    if (proposal && job) {
      if (
        job.hirer.toString() === userId ||
        proposal.provider.toString() === userId
      ) {
        return { job, proposal };
      }
    }
  }
  return null;
}

export async function listConversations(request, response) {
  try {
    const userId = request.user.id;
    const chats = await JobChat.find({ participants: userId })
      .populate("participants", "name avatar role activeMode profile")
      .populate("job", "title status category")
      .sort({ updatedAt: -1 })
      .lean();

    const conversations = chats.map((chat) => {
      const otherParticipant = chat.participants.find(
        (p) => p._id.toString() !== userId,
      ) || chat.participants[0] || {};

      const lastMessage = chat.messages.at(-1) || null;
      const unreadCount = chat.messages.filter(
        (m) => m.sender.toString() !== userId && !m.readAt,
      ).length;

      return {
        id: chat._id.toString(),
        chatId: chat._id.toString(),
        jobId: chat.job?._id?.toString() || null,
        proposalId: chat.proposal?.toString() || null,
        jobTitle: chat.job?.title || "Direct Message",
        participant: {
          id: otherParticipant._id?.toString() || "",
          name: otherParticipant.name || "User",
          avatar: otherParticipant.avatar || "",
          role: otherParticipant.activeMode || otherParticipant.role || "USER",
          category: otherParticipant.profile?.category || "",
          initials: (otherParticipant.name || "U")
            .split(/\s+/)
            .filter(Boolean)
            .map((p) => p[0])
            .join("")
            .slice(0, 2)
            .toUpperCase(),
        },
        lastMessage: lastMessage
          ? {
              body: lastMessage.body,
              senderId: lastMessage.sender.toString(),
              createdAt: lastMessage.createdAt,
            }
          : null,
        unreadCount,
        updatedAt: chat.updatedAt || chat.createdAt,
      };
    });

    return response.json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error("listConversations error:", error);
    return response.status(500).json({
      success: false,
      error: { code: "FETCH_FAILED", message: "Failed to fetch conversations" },
    });
  }
}

export async function initiateChat(request, response) {
  try {
    const userId = request.user.id;
    const { targetUserId, providerId, jobId, proposalId } = request.body;
    const recipientId = targetUserId || providerId;

    if (!recipientId && (!jobId || !proposalId)) {
      return response.status(400).json({
        success: false,
        error: { code: "INVALID_REQUEST", message: "Recipient user ID is required" },
      });
    }

    if (recipientId && recipientId === userId) {
      return response.status(400).json({
        success: false,
        error: { code: "INVALID_RECIPIENT", message: "Cannot chat with yourself" },
      });
    }

    let query = {};
    if (jobId && proposalId) {
      query = { job: jobId, proposal: proposalId };
    } else if (recipientId) {
      query = { participants: { $all: [userId, recipientId] } };
    }

    let chat = await JobChat.findOne(query);

    if (!chat) {
      const participants = recipientId
        ? [userId, recipientId]
        : [userId];
      
      if (jobId && proposalId) {
        const auth = await authorizedChat(jobId, proposalId, userId);
        if (auth && !participants.includes(auth.job.hirer.toString())) {
          participants.push(auth.job.hirer.toString());
        }
        if (auth && !participants.includes(auth.proposal.provider.toString())) {
          participants.push(auth.proposal.provider.toString());
        }
      }

      chat = await JobChat.create({
        participants,
        job: jobId || undefined,
        proposal: proposalId || undefined,
        messages: [],
      });
    }

    return response.status(201).json({
      success: true,
      chat: {
        id: chat._id.toString(),
        jobId: chat.job?.toString() || jobId || null,
        proposalId: chat.proposal?.toString() || proposalId || null,
      },
    });
  } catch (error) {
    console.error("initiateChat error:", error);
    return response.status(500).json({
      success: false,
      error: { code: "INITIATE_FAILED", message: "Failed to initiate conversation" },
    });
  }
}

export async function getChat(request, response) {
  try {
    const { jobId, proposalId, chatId } = request.params;
    let query = {};

    if (chatId) {
      query = { _id: chatId, participants: request.user.id };
    } else if (jobId && proposalId) {
      query = { job: jobId, proposal: proposalId, participants: request.user.id };
    }

    let chat = await JobChat.findOne(query)
      .populate("messages.sender", "name avatar")
      .populate("participants", "name avatar role activeMode profile")
      .lean();

    if (!chat && jobId && proposalId) {
      const auth = await authorizedChat(jobId, proposalId, request.user.id);
      if (auth) {
        chat = await JobChat.findOneAndUpdate(
          { job: jobId, proposal: proposalId },
          {
            $setOnInsert: {
              job: jobId,
              proposal: proposalId,
              participants: [auth.job.hirer, auth.proposal.provider],
            },
          },
          { upsert: true, new: true },
        )
          .populate("messages.sender", "name avatar")
          .populate("participants", "name avatar role activeMode profile")
          .lean();
      }
    }

    if (!chat) {
      return response.status(404).json({ error: "Chat conversation not found" });
    }

    const limit = Math.min(Math.max(Number(request.query.limit) || 50, 1), 100);
    const messages = (chat.messages || []).slice(-limit);

    return response.json({
      success: true,
      data: {
        chatId: chat._id.toString(),
        chat: { ...chat, id: chat._id.toString(), messages },
        messages,
      },
      error: null,
    });
  } catch (error) {
    console.error("getChat error:", error);
    return response.status(500).json({ error: "Failed to load chat" });
  }
}

export async function createChat(request, response) {
  return initiateChat(request, response);
}

export async function addMessage(request, response) {
  try {
    const { chatId, jobId, proposalId } = request.params;
    let query = {};

    if (chatId) {
      query = { _id: chatId, participants: request.user.id };
    } else if (jobId && proposalId) {
      query = { job: jobId, proposal: proposalId, participants: request.user.id };
    }

    const chat = await JobChat.findOne(query);
    if (!chat || chat.isArchived) {
      return response.status(409).json({ error: "Chat is unavailable or archived" });
    }

    const newMessage = {
      sender: request.user.id,
      body: maskContactInfo(request.body.body || request.body.message || ""),
      createdAt: new Date(),
    };

    chat.messages.push(newMessage);
    chat.updatedAt = new Date();
    await chat.save();

    const created = chat.messages.at(-1);
    return response.status(201).json({ success: true, message: created });
  } catch (error) {
    console.error("addMessage error:", error);
    return response.status(500).json({ error: "Failed to send message" });
  }
}

export async function markChatRead(request, response) {
  try {
    const { chatId, jobId, proposalId } = request.params;
    let query = {};

    if (chatId) {
      query = { _id: chatId, participants: request.user.id };
    } else if (jobId && proposalId) {
      query = { job: jobId, proposal: proposalId, participants: request.user.id };
    }

    const chat = await JobChat.findOne(query);
    if (!chat) return response.status(404).json({ error: "Chat not found" });

    const readAt = new Date();
    for (const message of chat.messages) {
      if (message.sender.toString() !== request.user.id) {
        message.readAt = readAt;
      }
    }
    await chat.save();

    return response.json({ success: true, data: { readAt }, error: null });
  } catch (error) {
    console.error("markChatRead error:", error);
    return response.status(500).json({ error: "Failed to mark chat as read" });
  }
}

export async function reportMessage(request, response) {
  try {
    const { MessageReport } = await import("../models/MessageReport.js");
    const { chatId, messageId } = request.params;
    const { reason } = request.body;

    const validReasons = ["harassment", "inappropriate_language", "attempted_circumvention", "scam", "spam", "other"];
    if (!reason || !validReasons.includes(reason)) {
      return response.status(400).json({
        success: false,
        error: { code: "INVALID_REASON", message: "A valid report reason is required" },
      });
    }

    const chat = await JobChat.findById(chatId);
    if (!chat) {
      return response.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Chat not found" } });
    }

    // Ensure reporter is a participant
    const reporterId = request.user.id;
    if (!chat.participants.map((p) => p.toString()).includes(reporterId)) {
      return response.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "You are not a participant of this chat" } });
    }

    const message = chat.messages.find((m) => m._id.toString() === messageId);
    if (!message) {
      return response.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Message not found" } });
    }

    // Cannot report your own messages
    const reportedUserId = message.sender.toString();
    if (reportedUserId === reporterId) {
      return response.status(400).json({ success: false, error: { code: "INVALID_TARGET", message: "You cannot report your own message" } });
    }

    const report = await MessageReport.create({
      chatId,
      messageId,
      reporterId,
      reportedUserId,
      reason,
      snapshotContent: message.body,
    });

    return response.status(201).json({ success: true, reportId: report._id.toString() });
  } catch (error) {
    if (error.code === 11000) {
      return response.status(409).json({ success: false, error: { code: "ALREADY_REPORTED", message: "You have already reported this message" } });
    }
    console.error("reportMessage error:", error);
    return response.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Failed to submit report" } });
  }
}

