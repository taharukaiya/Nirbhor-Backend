/**
 * Wallet Management Routes
 * 
 * Architectural Intent:
 * Interfaces directly with the user's internal Wallet logic. Facilitates withdrawal 
 * requests (Payouts) and provides endpoints to check current balances without triggering 
 * a full transaction history scan.
 */
import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { getWalletData, requestWithdrawal, initiateDeposit } from "../controllers/walletController.js";

const router = Router();

router.get("/", authenticate, asyncHandler(getWalletData));
router.post("/withdraw", authenticate, asyncHandler(requestWithdrawal));
router.post("/deposit", authenticate, asyncHandler(initiateDeposit));

export default router;
