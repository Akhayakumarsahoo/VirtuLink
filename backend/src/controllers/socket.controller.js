import { Server } from "socket.io";

const connectToSocket = (server) => {
  const allowedOrigins = [
    process.env.NODE_ENV === "development"
      ? "http://localhost:5173"
      : "https://virtu-link.vercel.app",
  ];

  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      allowedHeaders: ["*"],
      credentials: true,
    },
    pingTimeout: 60000, // Increase ping timeout to prevent disconnections
  });

  // Store active connections and user information
  const connections = {};
  const users = {};
  const mediaStatus = {};

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on("join:room", ({ room, username = "User", offer }) => {
      try {
        if (!room) {
          socket.emit("error", { message: "Room ID is required" });
          return;
        }

        // Leave any existing room first
        if (users[socket.id]?.room) {
          const oldRoom = users[socket.id].room;
          socket.leave(oldRoom);
          connections[oldRoom] = connections[oldRoom].filter(
            (id) => id !== socket.id
          );
          if (connections[oldRoom].length === 0) {
            delete connections[oldRoom];
          }
        }

        // Initialize room if it doesn't exist
        if (!connections[room]) {
          connections[room] = [];
        }

        // Add user to room if not already in it
        if (!connections[room].includes(socket.id)) {
          connections[room].push(socket.id);
        }

        // Store user info
        users[socket.id] = {
          room,
          username: username || `User-${socket.id.substring(0, 5)}`,
          offer,
        };

        // Initialize media status based on the offer
        const hasVideo = offer?.sdp?.includes("m=video");
        const hasAudio = offer?.sdp?.includes("m=audio");
        mediaStatus[socket.id] = {
          isVideoOn: hasVideo,
          isAudioOn: hasAudio,
        };

        // Join the socket room
        socket.join(room);

        // Collect user data for all users in this room
        const roomUsers = {};
        connections[room].forEach((userId) => {
          if (users[userId]) {
            roomUsers[userId] = {
              username: users[userId].username,
            };
          }
        });

        // Notify all users in the room about the new user
        io.to(room).emit(
          "user:joined",
          socket.id,
          connections[room],
          roomUsers
        );
      } catch (error) {
        console.error("Error in join:room:", error);
        socket.emit("error", { message: "Failed to join room" });
      }
    });

    // Handle WebRTC signaling
    socket.on("signal", (toId, message) => {
      try {
        if (!toId || typeof toId !== "string") {
          return socket.emit("error", { message: "Invalid target ID" });
        }

        const targetSocket = io.sockets.sockets.get(toId);
        if (!targetSocket) {
          return socket.emit("error", { message: "Target user not found" });
        }

        io.to(toId).emit("signal", socket.id, message);
      } catch (error) {
        console.error("Error in signal handler:", error);
        socket.emit("error", { message: "Failed to forward signal" });
      }
    });

    // Handle media status updates
    socket.on("media:status", (data) => {
      try {
        const { room, isVideoOn, isAudioOn } = data;

        if (!users[socket.id]?.room) return;

        mediaStatus[socket.id] = { isVideoOn, isAudioOn };

        io.to(room).emit(
          "media:status-update",
          socket.id,
          users[socket.id].username,
          isVideoOn,
          isAudioOn
        );
      } catch (error) {
        console.error("Error in media:status handler:", error);
      }
    });

    // Handle user disconnection
    socket.on("disconnect", () => {
      const user = users[socket.id];
      if (user?.room) {
        // Remove user from room connections
        connections[user.room] = connections[user.room].filter(
          (id) => id !== socket.id
        );

        // Notify other users
        io.to(user.room).emit("user:left", socket.id);

        // Clean up user data
        delete users[socket.id];
        delete mediaStatus[socket.id];

        // Remove room if empty
        if (connections[user.room].length === 0) {
          delete connections[user.room];
        }
      }
    });

    // Handle room leaving
    socket.on("leave:room", () => {
      const user = users[socket.id];
      if (user?.room) {
        socket.leave(user.room);
        connections[user.room] = connections[user.room].filter(
          (id) => id !== socket.id
        );
        io.to(user.room).emit("user:left", socket.id);
        delete users[socket.id];
        delete mediaStatus[socket.id];
      }
    });
  });
};

export { connectToSocket };
