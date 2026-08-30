import mongoose from "mongoose";
import { config } from "../config.js";

export async function connectDatabase() {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await mongoose.connect(config.mongoUri);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(attempt * 1000, 5000)),
      );
    }
  }
  throw lastError;
}
