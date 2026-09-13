import { Router } from "express";
import { authenticate, requireVerifiedNID } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  initiatePayment,
  paymentIpn,
  releasePayment,
  processJobPayment,
  payWithWallet,
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
router.post("/sslcommerz/success", (request, response) => {
  const tranId = request.body?.tran_id || "";
  response.redirect(`${process.env.FRONTEND_ORIGIN || "http://localhost:5173"}/payment/success?tran_id=${tranId}`);
});
router.post("/sslcommerz/fail", (request, response) => {
  response.redirect(`${process.env.FRONTEND_ORIGIN || "http://localhost:5173"}/payment/failed`);
});
router.post("/sslcommerz/cancel", (request, response) => {
  response.redirect(`${process.env.FRONTEND_ORIGIN || "http://localhost:5173"}/payment/failed`);
});
router.post(
  "/:jobId/mock-pay",
  authenticate,
  requireVerifiedNID,
  asyncHandler(processJobPayment),
);
router.post(
  "/:jobId/wallet-pay",
  authenticate,
  requireVerifiedNID,
  asyncHandler(payWithWallet),
);
export default router;
