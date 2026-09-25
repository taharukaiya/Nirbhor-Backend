/**
 * Real-Time Chat HTTP Fallback & Metadata Routes
 * 
 * Architectural Intent:
 * While actual messages are transported via Socket.IO for real-time delivery, these HTTP 
 * endpoints serve as the RESTful interface for fetching chat history, initiating new chat 
 * instances, and marking rooms as read.
 */
import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { chatGuard } from "../middleware/chatGuard.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  addMessage,
  createChat,
  getChat,
  initiateChat,
  listConversations,
  markChatRead,
  reportMessage,
} from "../controllers/chatController.js";

const router = Router();
router.use(authenticate);

// Conversations & direct initiation
router.get("/conversations", asyncHandler(listConversations));
router.post("/initiate", asyncHandler(initiateChat));

// Direct chat rooms by chatId
router.get("/room/:chatId", asyncHandler(getChat));
router.post("/room/:chatId/messages", chatGuard, asyncHandler(addMessage));
router.post("/room/:chatId/read", asyncHandler(markChatRead));
router.post("/room/:chatId/messages/:messageId/report", asyncHandler(reportMessage));

// Job/Proposal specific routes
router.get("/:jobId/:proposalId", asyncHandler(getChat));
router.post("/:jobId/:proposalId", asyncHandler(createChat));
router.post(
  "/:jobId/:proposalId/messages",
  chatGuard,
  asyncHandler(addMessage),
);
router.post("/:jobId/:proposalId/read", asyncHandler(markChatRead));

export default router;

