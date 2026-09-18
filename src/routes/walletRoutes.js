import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { getWalletData, requestWithdrawal, initiateDeposit } from "../controllers/walletController.js";

const router = Router();

router.get("/", authenticate, asyncHandler(getWalletData));
router.post("/withdraw", authenticate, asyncHandler(requestWithdrawal));
router.post("/deposit", authenticate, asyncHandler(initiateDeposit));

export default router;
