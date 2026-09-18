import { Router } from "express";
import { authenticate, requireVerifiedNID } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  initiatePayment,
  paymentIpn,
  releasePayment,
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
router.post("/sslcommerz/success", async (request, response) => {
  const tranId = request.body?.tran_id || "";
  const valId = request.body?.val_id || "";
  try {
    const { processPaymentFulfillment } = await import("../controllers/paymentController.js");
    await processPaymentFulfillment(tranId, valId);
  } catch (err) {
    console.error("Success URL sync error:", err);
  }
  response.redirect(`${process.env.FRONTEND_ORIGIN || "http://localhost:5173"}/payment/success?tran_id=${tranId}`);
});
router.post("/sslcommerz/fail", (request, response) => {
  response.redirect(`${process.env.FRONTEND_ORIGIN || "http://localhost:5173"}/payment/failed`);
});
router.post("/sslcommerz/cancel", (request, response) => {
  response.redirect(`${process.env.FRONTEND_ORIGIN || "http://localhost:5173"}/payment/failed`);
});

router.post(
  "/:jobId/wallet-pay",
  authenticate,
  requireVerifiedNID,
  asyncHandler(payWithWallet),
);
export default router;
