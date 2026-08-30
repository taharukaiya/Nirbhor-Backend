import { Router } from "express";
import { authenticate, requireVerifiedNID } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  initiatePayment,
  paymentIpn,
  releasePayment,
} from "../controllers/paymentController.js";

const router = Router();
router.post(
  "/:jobId/initiate",
  authenticate,
  requireVerifiedNID,
  asyncHandler(initiatePayment),
);
router.post(
  "/:jobId/release",
  authenticate,
  requireVerifiedNID,
  asyncHandler(releasePayment),
);
router.post("/sslcommerz/ipn", asyncHandler(paymentIpn));
router.post("/sslcommerz/success", (_request, response) =>
  response.redirect(process.env.FRONTEND_ORIGIN || "/"),
);
router.post("/sslcommerz/fail", (_request, response) =>
  response.redirect(process.env.FRONTEND_ORIGIN || "/"),
);
router.post("/sslcommerz/cancel", (_request, response) =>
  response.redirect(process.env.FRONTEND_ORIGIN || "/"),
);
export default router;
