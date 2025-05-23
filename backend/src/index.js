import dotenv from "dotenv";
dotenv.config({ path: "./.env" });
import { createServer } from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import mongoose from "mongoose";
import { connectToSocket } from "./controllers/socket.controller.js";
import userRouter from "./routes/users.routes.js";

const app = express();
const server = createServer(app);

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.VITE_FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

// Routes
app.use("/api/users", userRouter);

// Initialize Socket.IO
connectToSocket(server);

const { PORT = 9000, MONGODB_URI } = process.env;

// Connect to MongoDB and start the server
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected");
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  });
