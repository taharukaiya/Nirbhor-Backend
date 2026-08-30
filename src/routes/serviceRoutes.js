import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { listServices } from "../controllers/serviceController.js";

const router = Router();
router.get("/", asyncHandler(listServices));
export default router;
