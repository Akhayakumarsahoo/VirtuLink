import { Server } from "socket.io";

const connectToSocket = (server) => {
  const allowedOrigins = [
    process.env.NODE_ENV === "development"
      ? "http://localhost:5173"
      : "https://virtu-link.vercel.app",
  ];

  const io = new Server(server, {
    cors: {
      origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    },
    pingTimeout: 60000,
    transports: ["websocket", "polling"],
  });

  // Store active connections by room
  const connections = {};
  // Store user information
  const users = {};
  // Track time online
  const timeOnline = {};
  // Track timeline events for each room
  const roomTimelines = {};
  // Track media status (video/audio) by user
  const mediaStatus = {};

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle room joining
    socket.on("join:room", (data) => {
      try {
        const { room, username } = data;

        if (!room) {
          console.error(
            `User ${socket.id} tried to join a room without providing a room ID`
          );
          socket.emit("error", { message: "Room ID is required" });
          return;
        }

        console.log(
          `User ${socket.id} joining room: ${room} as ${
            username || "Anonymous"
          }`
        );

        // Initialize room if it doesn't exist
        if (!connections[room]) {
          connections[room] = [];
          roomTimelines[room] = [];
          console.log(`Created new room: ${room}`);
        }

        // Add user to room if not already in it
        if (!connections[room].includes(socket.id)) {
          connections[room].push(socket.id);
        }

        // Store user info
        users[socket.id] = {
          room,
          username: username || `User-${socket.id.substring(0, 5)}`,
        };

        // Initialize media status for this user
        mediaStatus[socket.id] = {
          isVideoOn: true,
          isAudioOn: true,
        };

        // Track connection time
        timeOnline[socket.id] = new Date();

        // Add join event to timeline
        const joinEvent = {
          type: "join",
          userId: socket.id,
          username: users[socket.id].username,
          timestamp: new Date().toISOString(),
        };
        roomTimelines[room].push(joinEvent);

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

        // Notify all users in the room about the new user, send user data
        io.to(room).emit(
          "user:joined",
          socket.id,
          connections[room],
          roomUsers
        );
        io.to(room).emit("timeline:update", roomTimelines[room]);

        // Log active connections
        console.log(`Room ${room} connections:`, connections[room]);

        // Confirm to the user that they've joined the room
        socket.emit("room:joined", {
          room,
          participants: connections[room].length,
          users: roomUsers,
          success: true,
        });
      } catch (error) {
        console.error("Error in join:room:", error);
        socket.emit("error", { message: "Failed to join room" });
      }
    });

    // Handle WebRTC signaling
    socket.on("signal", (toId, message) => {
      try {
        // Forward the signal to the specified user
        if (toId && io.sockets.sockets.get(toId)) {
          console.log(`Signal from ${socket.id} to ${toId}`);
          io.to(toId).emit("signal", socket.id, message);
        } else {
          console.warn(`Cannot forward signal to ${toId} - user not found`);
        }
      } catch (error) {
        console.error("Error in signal handler:", error);
      }
    });

    // Handle media status updates
    socket.on("media:status", (data) => {
      try {
        const { room, isVideoOn, isAudioOn } = data;

        if (!users[socket.id] || !users[socket.id].room) {
          console.warn(
            `User ${socket.id} tried to update media status without being in a room`
          );
          return;
        }

        const userRoom = users[socket.id].room;

        // Update the media status for this user
        mediaStatus[socket.id] = {
          isVideoOn: isVideoOn,
          isAudioOn: isAudioOn,
        };

        console.log(
          `Media status update from ${socket.id}: video=${isVideoOn}, audio=${isAudioOn}`
        );

        // Broadcast the updated status to all users in the room
        io.to(userRoom).emit(
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
      try {
        console.log(`User disconnected: ${socket.id}`);

        // Get user's room
        const user = users[socket.id];
        if (user) {
          const { room } = user;

          // Remove user from room connections
          if (connections[room]) {
            connections[room] = connections[room].filter(
              (id) => id !== socket.id
            );

            // Calculate time online
            const timeConnected = new Date() - timeOnline[socket.id];

            // Add leave event to timeline
            const leaveEvent = {
              type: "leave",
              userId: socket.id,
              username: user.username,
              timestamp: new Date().toISOString(),
              duration: timeConnected / 1000, // Convert to seconds
            };
            roomTimelines[room].push(leaveEvent);

            // Notify remaining users about the disconnection and timeline update
            io.to(room).emit("user:left", socket.id);
            io.to(room).emit("timeline:update", roomTimelines[room]);

            // Clean up empty rooms
            if (connections[room].length === 0) {
              delete connections[room];
              delete roomTimelines[room];
              console.log(`Room ${room} is now empty and has been removed`);
            } else {
              console.log(
                `Room ${room} connections after disconnect:`,
                connections[room]
              );
            }
          }

          // Calculate time online
          const timeConnected = new Date() - timeOnline[socket.id];
          console.log(
            `User ${socket.id} was connected for ${
              timeConnected / 1000
            } seconds`
          );

          // Clean up user data
          delete users[socket.id];
          delete timeOnline[socket.id];
          delete mediaStatus[socket.id];
        }
      } catch (error) {
        console.error("Error in disconnect handler:", error);
      }
    });

    // Handle explicit leave room request
    socket.on("leave:room", () => {
      try {
        const user = users[socket.id];
        if (user) {
          const { room } = user;

          // Remove user from room connections
          if (connections[room]) {
            connections[room] = connections[room].filter(
              (id) => id !== socket.id
            );

            // Calculate time online
            const timeConnected = new Date() - timeOnline[socket.id];

            // Add leave event to timeline
            const leaveEvent = {
              type: "leave",
              userId: socket.id,
              username: user.username,
              timestamp: new Date().toISOString(),
              duration: timeConnected / 1000, // Convert to seconds
            };
            roomTimelines[room].push(leaveEvent);

            // Notify remaining users about the disconnection and timeline update
            io.to(room).emit("user:left", socket.id);
            io.to(room).emit("timeline:update", roomTimelines[room]);

            // Leave the socket room
            socket.leave(room);

            console.log(`User ${socket.id} left room ${room}`);

            // Clean up empty rooms
            if (connections[room].length === 0) {
              delete connections[room];
              delete roomTimelines[room];
              console.log(`Room ${room} is now empty and has been removed`);
            }
          }

          // Clean up user data
          delete users[socket.id];
          delete timeOnline[socket.id];
          delete mediaStatus[socket.id];
        }
      } catch (error) {
        console.error("Error in leave:room handler:", error);
      }
    });

    // Handle chat messages
    socket.on("chat:message", (message) => {
      try {
        const user = users[socket.id];
        if (user) {
          const { room, username } = user;

          // Broadcast message to all users in the room
          io.to(room).emit("chat:message", {
            sender: socket.id,
            username,
            message,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error("Error in chat:message handler:", error);
      }
    });

    // Ping-pong to keep connection alive
    socket.on("ping", () => {
      socket.emit("pong");
    });
  });

  // Log active connections every minute for debugging
  setInterval(() => {
    console.log("Active connections:", Object.keys(users).length);
    console.log("Active rooms:", Object.keys(connections).length);
  }, 60000);

  // Return the io instance for potential external use
  return io;
};

export { connectToSocket };
