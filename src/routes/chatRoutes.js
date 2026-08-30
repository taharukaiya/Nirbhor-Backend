import { Router } from "express";
import { authenticate, requireVerifiedNID } from "../middleware/auth.js";
import { chatGuard } from "../middleware/chatGuard.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  addMessage,
  createChat,
  getChat,
  markChatRead,
} from "../controllers/chatController.js";

const router = Router();
router.use(authenticate, requireVerifiedNID);
router.get("/:jobId/:proposalId", asyncHandler(getChat));
router.post("/:jobId/:proposalId", asyncHandler(createChat));
router.post(
  "/:jobId/:proposalId/messages",
  chatGuard,
  asyncHandler(addMessage),
);
router.post("/:jobId/:proposalId/read", asyncHandler(markChatRead));
export default router;
