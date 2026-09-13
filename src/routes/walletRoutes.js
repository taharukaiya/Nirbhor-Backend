import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { getWalletData } from "../controllers/walletController.js";

const router = Router();

router.get("/", authenticate, asyncHandler(getWalletData));

export default router;
