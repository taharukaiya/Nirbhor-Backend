/**
 * Database Initialization
 * 
 * Architectural Intent:
 * Connects the application to MongoDB via Mongoose. Segregated from `server.js` 
 * to allow tests or CLI scripts (e.g. database seeders) to establish a database 
 * connection without starting the Express HTTP server.
 */
import mongoose from "mongoose";
import { config } from "./config.js";

export async function connectDatabase() {
  await mongoose.connect(config.mongoUri);
}
