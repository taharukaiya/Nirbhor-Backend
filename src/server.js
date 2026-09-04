import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import http from "node:http";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { Server as SocketServer } from "socket.io";
import { config, isAllowedOrigin } from "./config.js";
import { connectDatabase } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import adminAuthRoutes from "./routes/adminAuthRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import { registerChatSocket } from "./sockets/chatSocket.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimiters.js";
import { dbHealthCheck } from "./middleware/dbHealthCheck.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
    credentials: true,
  }),
);
app.use(apiLimiter);
app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());
app.use((request, _response, next) => {
  request.requestId = crypto.randomUUID();
  const startedAt = Date.now();
  request.on("close", () =>
    console.log(
      JSON.stringify({
        requestId: request.requestId,
        method: request.method,
        path: request.originalUrl,
        durationMs: Date.now() - startedAt,
      }),
    ),
  );
  next();
});
app.get("/api/health", (_request, response) => response.json({ status: "ok" }));
app.use(dbHealthCheck);
app.use("/api/auth", authRoutes);
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use((request, response) =>
  response.status(404).json({
    success: false,
    data: null,
    error: { code: "NOT_FOUND", message: "Route not found" },
  }),
);
app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  const httpServer = http.createServer(app);
  const io = new SocketServer(httpServer, {
    cors: { origin: config.frontendOrigins, credentials: true },
  });
  registerChatSocket(io);

  // Start server immediately to handle requests
  httpServer.listen(config.port, () => {
    console.log(
      JSON.stringify({ event: "server_listening", port: config.port }),
    );
  });

  // Connect to database in the background
  let dbConnected = false;
  connectDatabase()
    .then(() => {
      dbConnected = true;
      console.log(JSON.stringify({ event: "database_connected" }));
    })
    .catch((error) => {
      console.error(
        JSON.stringify({
          event: "database_connection_failed",
          message: error.message,
        }),
      );
      // Exit after attempts exhausted, but keep server running to report health
    });

  // Health check endpoint returns 503 if DB is not ready
  app.get("/api/health/ready", (_request, response) => {
    if (!dbConnected) {
      return response.status(503).json({
        status: "not_ready",
        message: "Database connection pending",
      });
    }
    return response.json({ status: "ok", database: "connected" });
  });

  const shutdown = async (signal) => {
    await new Promise((resolve) => httpServer.close(resolve));
    try {
      await mongoose.disconnect();
    } catch {
      // Already disconnected or error
    }
    console.log(JSON.stringify({ event: "server_stopped", signal }));
    process.exit(0);
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

export default app;
