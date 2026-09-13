import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { getServiceProvider, listServices } from "../controllers/serviceController.js";

const router = Router();
router.get("/", asyncHandler(listServices));
router.get("/:id", asyncHandler(getServiceProvider));

export default router;
