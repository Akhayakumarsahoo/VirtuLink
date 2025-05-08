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
    origin:
      process.env.NODE_ENV === "production"
        ? "https://virtu-link.vercel.app"
        : "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// Routes
app.use("/api/users", userRouter);

// Initialize Socket.IO with the HTTP server
connectToSocket(server);

const { PORT = 9000, MONGODB_URI } = process.env;

// Connect to MongoDB and start the server
(async () => {
  try {
    await mongoose
      .connect(MONGODB_URI)
      .then(() => console.log("MongoDB connected"));

    // Use the HTTP server to listen, not the Express app
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Socket.IO server is running on the same port`);
    });
  } catch (error) {
    console.log("MongoDB connection failed", error);
    throw error;
  }
})();
