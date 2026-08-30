import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { Job } from "../models/Job.js";
import { Proposal } from "../models/Proposal.js";
import { JobChat } from "../models/JobChat.js";
import {
  containsContactInfo,
  maskContactInfo,
} from "../utils/contactFilter.js";

export function registerChatSocket(io) {
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
      async ({ jobId, proposalId }, acknowledge = () => {}) => {
        try {
          const proposal = await Proposal.findOne({
            _id: proposalId,
            job: jobId,
          }).lean();
          const job = await Job.findById(jobId).lean();
          if (
            !proposal ||
            !job ||
            ![String(job.hirer), String(proposal.provider)].includes(
              socket.userId,
            )
          )
            return acknowledge({ error: "Unauthorized chat" });
          const chat = await JobChat.findOneAndUpdate(
            { job: jobId, proposal: proposalId },
            {
              $setOnInsert: {
                job: jobId,
                proposal: proposalId,
                participants: [job.hirer, proposal.provider],
              },
            },
            { upsert: true, new: true },
          );
          socket.join(`chat:${chat.id}`);
          acknowledge({ chatId: chat.id, archived: chat.isArchived });
        } catch {
          acknowledge({ error: "Unable to join chat" });
        }
      },
    );
    socket.on(
      "chat:message",
      async ({ chatId, body }, acknowledge = () => {}) => {
        try {
          if (!body || containsContactInfo(body))
            return acknowledge({ error: "Contact details cannot be shared" });
          const chat = await JobChat.findOne({
            _id: chatId,
            participants: socket.userId,
          });
          if (!chat || chat.isArchived)
            return acknowledge({ error: "Chat is archived" });
          chat.messages.push({
            sender: socket.userId,
            body: maskContactInfo(body),
          });
          await chat.save();
          const message = chat.messages.at(-1);
          io.to(`chat:${chat.id}`).emit("chat:message", message);
          acknowledge({ message });
        } catch {
          acknowledge({ error: "Unable to send message" });
        }
      },
    );
  });
}
