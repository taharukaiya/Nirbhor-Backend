/**
 * Chat WebSockets Manager
 * 
 * Architectural Intent:
 * Provides real-time bidirectional communication using Socket.io. 
 * Manages the lifecycle of real-time chat rooms, typing indicators, and read receipts.
 * 
 * Security:
 * 1. Custom Middleware: Extracts the JWT from the `access_token` cookie for authentication 
 *    since WebSockets do not easily pass standard HTTP Authorization headers.
 * 2. Room Isolation: Users join a private room `user:<userId>` to receive targeted system 
 *    notifications, and `chat:<chatId>` to receive messages.
 * 3. Trust & Safety: Messages are piped through `maskContactInfo` in `contactFilter.js` 
 *    before being saved or broadcast, preventing platform circumvention.
 */
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { Job } from "../models/Job.js";
import { Proposal } from "../models/Proposal.js";
import { JobChat } from "../models/JobChat.js";
import {
  containsContactInfo,
  maskContactInfo,
} from "../utils/contactFilter.js";

let ioInstance = null;

export function registerChatSocket(io) {
  ioInstance = io;
  
  // Socket.io Authentication Middleware
  io.use((socket, next) => {
    try {
      const payload = jwt.verify(
        decodeURIComponent(
          socket.handshake.headers.cookie?.match(
            /(?:^|; )access_token=([^;]+)/,
          )?.[1] || "",
        ),
        config.accessSecret,
        { algorithms: ["HS256"] },
      );
      if (payload.accountType !== "USER" || typeof payload.userId !== "string")
        throw new Error("Invalid account");
      socket.userId = payload.userId;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    // Join a private room for user-specific system notifications
    socket.join(`user:${socket.userId}`);
    
    socket.on("disconnect", (reason) =>
      console.log(
        JSON.stringify({
          event: "socket_disconnect",
          userId: socket.userId,
          reason,
        }),
      ),
    );

    socket.on(
      "chat:typing",
      async ({ chatId, isTyping }, acknowledge = () => {}) => {
        try {
          if (
            !(await JobChat.exists({
              _id: chatId,
              participants: socket.userId,
            }))
          )
            return acknowledge({ error: "Unauthorized chat" });
          
          // Broadcast typing event to everyone in the room EXCEPT the sender
          socket
            .to(`chat:${chatId}`)
            .emit("chat:typing", {
              userId: socket.userId,
              isTyping: Boolean(isTyping),
            });
          acknowledge({ ok: true });
        } catch {
          acknowledge({ error: "Unable to update typing state" });
        }
      },
    );

    socket.on("chat:read", async ({ chatId }, acknowledge = () => {}) => {
      try {
        const chat = await JobChat.findOne({
          _id: chatId,
          participants: socket.userId,
        });
        if (!chat) return acknowledge({ error: "Unauthorized chat" });
        const readAt = new Date();
        for (const message of chat.messages)
          if (message.sender.toString() !== socket.userId)
            message.readAt = readAt;
        await chat.save();
        io.to(`chat:${chatId}`).emit("chat:read", {
          userId: socket.userId,
          readAt,
        });
        acknowledge({ ok: true });
      } catch {
        acknowledge({ error: "Unable to mark chat read" });
      }
    });

    socket.on(
      "chat:join",
      async ({ chatId, jobId, proposalId, targetUserId }, acknowledge = () => {}) => {
        try {
          let chat = null;

          if (chatId) {
            chat = await JobChat.findOne({
              _id: chatId,
              participants: socket.userId,
            });
          } else if (jobId && proposalId) {
            // Contextual Job-Proposal Chat initiation
            chat = await JobChat.findOne({ job: jobId, proposal: proposalId });
            if (!chat) {
              const proposal = await Proposal.findOne({ _id: proposalId, job: jobId }).lean();
              const job = await Job.findById(jobId).lean();
              if (proposal && job && [String(job.hirer), String(proposal.provider)].includes(socket.userId)) {
                chat = await JobChat.create({
                  job: jobId,
                  proposal: proposalId,
                  participants: [job.hirer, proposal.provider],
                });
              }
            }
          } else if (targetUserId) {
            // Generic direct message initiation
            chat = await JobChat.findOne({ participants: { $all: [socket.userId, targetUserId] } });
            if (!chat) {
              chat = await JobChat.create({
                participants: [socket.userId, targetUserId],
                messages: [],
              });
            }
          }

          if (!chat || !chat.participants.map(p => p.toString()).includes(socket.userId)) {
            return acknowledge({ error: "Unauthorized or chat not found" });
          }

          socket.join(`chat:${chat.id || chat._id}`);
          acknowledge({ chatId: (chat.id || chat._id).toString(), archived: !!chat.isArchived });
        } catch (err) {
          console.error("chat:join error:", err);
          acknowledge({ error: "Unable to join chat" });
        }
      },
    );

    socket.on(
      "chat:message",
      async ({ chatId, body, type, audioUrl }, acknowledge = () => {}) => {
        try {
          // Trust & Safety Constraint: Prevent sending phone numbers / emails directly
          if (type !== "AUDIO" && (!body || containsContactInfo(body)))
            return acknowledge({ error: "Contact details cannot be shared" });
          
          const chat = await JobChat.findOne({
            _id: chatId,
            participants: socket.userId,
          });
          if (!chat || chat.isArchived)
            return acknowledge({ error: "Chat is archived" });
          
          let messageBody = "";
          if (type !== "AUDIO") {
            messageBody = maskContactInfo(body || "");
          }

          chat.messages.push({
            sender: socket.userId,
            type: type === "AUDIO" ? "AUDIO" : "TEXT",
            body: messageBody,
            audioUrl: type === "AUDIO" ? audioUrl : undefined,
          });
          await chat.save();
          const message = chat.messages.at(-1);
          const messageObj = message.toObject();
          messageObj.chatId = chat.id || chat._id;
          
          // Broadcast message to everyone in the chat room (including sender to confirm receipt)
          io.to(`chat:${chat.id}`).emit("chat:message", messageObj);
          acknowledge({ message: messageObj });
        } catch {
          acknowledge({ error: "Unable to send message" });
        }
      },
    );
  });
}

/**
 * Helper to emit system-wide notifications to a specific user regardless of what room they are in.
 */
export function emitNotification(userId, notification) {
  if (ioInstance) {
    ioInstance.to(`user:${userId}`).emit("notification:new", notification);
  }
}
