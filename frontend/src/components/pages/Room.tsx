import { useEffect, useRef, useState } from "react";
import { useSocket } from "../contexts/SocketProvider";
import { useParams, useNavigate } from "react-router-dom";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  LogOut,
  FlipHorizontal,
  MonitorSmartphone,
  ClipboardCopy,
  Users,
} from "lucide-react";

declare global {
  interface Window {
    localStream: MediaStream | null;
  }
}

interface VideoItem {
  socketId: string;
  stream: MediaStream;
  autoplay: boolean;
  playsinline: boolean;
  username?: string;
  isVideoOn?: boolean;
  isAudioOn?: boolean;
}

const peerConfigConnections = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// Fix: Using an object instead of array for connections
const connections: Record<string, RTCPeerConnection> = {};

// Utility function to generate consistent avatar colors
const getAvatarColors = (identifier: string) => {
  // Get a consistent hash code from the string
  const hash = identifier.split("").reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);

  // Generate colors based on the hash
  const h = Math.abs(hash) % 360;

  // Create two slightly different hues for gradient
  return {
    from: `hsl(${h}, 70%, 50%)`,
    to: `hsl(${(h + 30) % 360}, 70%, 45%)`,
  };
};

function Room() {
  const socket = useSocket();
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [video, setVideo] = useState<boolean>(false);
  const [audio, setAudio] = useState<boolean>(false);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const videoRef = useRef<VideoItem[]>([]);
  const [videoAvailable, setVideoAvailable] = useState(false);
  const [audioAvailable, setAudioAvailable] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("disconnected");
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [roomName, setRoomName] = useState<string>(roomId || "default-room");
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [screenShareAvailable, setScreenShareAvailable] =
    useState<boolean>(false);
  const [isMirrored, setIsMirrored] = useState<boolean>(true);
  const [users, setUsers] = useState<Record<string, { username: string }>>({});

  const getPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setVideoAvailable(true);
      setAudioAvailable(true);

      window.localStream = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Check screen share capability
      try {
        setScreenShareAvailable(!!navigator.mediaDevices.getDisplayMedia);
      } catch (e) {
        setScreenShareAvailable(false);
        console.log("Screen sharing not available:", e);
      }
    } catch (error) {
      console.log("Error getting permissions", error);
      setVideoAvailable(false);
      setAudioAvailable(false);
    }
  };

  const silence = () => {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const dst = oscillator.connect(
      ctx.createMediaStreamDestination()
    ) as MediaStreamAudioDestinationNode;
    oscillator.start();
    ctx.resume();
    return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
  };

  const black = ({ width = 640, height = 480 } = {}) => {
    const canvas = Object.assign(document.createElement("canvas"), {
      width,
      height,
    });
    canvas.getContext("2d")?.fillRect(0, 0, width, height);
    const stream = canvas.captureStream();
    return Object.assign(stream.getVideoTracks()[0], { enabled: false });
  };

  const getUserMedia = (stream: MediaStream) => {
    try {
      window.localStream?.getTracks().forEach((track) => track.stop());
    } catch (e) {
      console.log(e);
    }

    window.localStream = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    for (const id in connections) {
      if (id === socket?.id) continue;

      // Fix: Use addTrack instead of addStream for modern WebRTC
      if (connections[id] && window.localStream) {
        window.localStream.getTracks().forEach((track) => {
          if (window.localStream) {
            connections[id].addTrack(track, window.localStream);
          }
        });
      }

      connections[id].createOffer().then((description) => {
        connections[id]
          .setLocalDescription(description)
          .then(() => {
            socket?.emit(
              "signal",
              id,
              JSON.stringify({ sdp: connections[id].localDescription })
            );
          })
          .catch((e) => console.log(e));
      });
    }

    stream.getTracks().forEach(
      (track) =>
        (track.onended = () => {
          setVideo(false);
          setAudio(false);

          try {
            if (localVideoRef.current && localVideoRef.current.srcObject) {
              const tracks = (
                localVideoRef.current.srcObject as MediaStream
              ).getTracks();
              tracks.forEach((track) => track.stop());
            }
          } catch (e) {
            console.log(e);
          }

          const blackSilence = () => new MediaStream([black(), silence()]);
          window.localStream = blackSilence();
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = window.localStream;
          }

          for (const id in connections) {
            // Clear existing tracks
            const senders = connections[id].getSenders();
            senders.forEach((sender) => {
              connections[id].removeTrack(sender);
            });

            // Add black/silence tracks
            if (window.localStream) {
              window.localStream.getTracks().forEach((track) => {
                if (window.localStream) {
                  connections[id].addTrack(track, window.localStream);
                }
              });
            }

            connections[id].createOffer().then((description) => {
              connections[id]
                .setLocalDescription(description)
                .then(() => {
                  socket?.emit(
                    "signal",
                    id,
                    JSON.stringify({ sdp: connections[id].localDescription })
                  );
                })
                .catch((e) => console.log(e));
            });
          }
        })
    );
  };

  const connectToSocketServer = () => {
    if (!socket) return;

    setConnectionStatus("connecting");
    let pingIntervalId: number | null = null;

    // Define functions first
    const startPingInterval = () => {
      // Send a ping every 30 seconds to keep the connection alive
      const pingInterval = setInterval(() => {
        if (socket.connected) {
          socket.emit("ping");
        }
      }, 30000);

      return pingInterval;
    };

    const joinRoom = () => {
      if (socket && socket.connected && roomName) {
        console.log(`Joining room: ${roomName}`);
        const username = localStorage.getItem("username") || undefined;
        socket.emit("join:room", {
          room: roomName,
          username: username,
        });
      } else {
        console.error(
          "Cannot join room: Socket not connected or room name not set"
        );
      }
    };

    // Make sure we're not already connected
    socket.off("connect");
    socket.off("user:joined");
    socket.off("signal");
    socket.off("user:left");
    socket.off("disconnect");
    socket.off("pong");
    socket.off("room:joined");
    socket.off("error");
    socket.off("media:status-update");

    // Handle successful room joining
    socket.on("room:joined", (data) => {
      console.log("Successfully joined room:", data);
      setConnectionStatus("connected");

      // If the server sends user data with the room join response
      if (data.users) {
        setUsers(data.users);
      }
    });

    // Handle errors
    socket.on("error", (error) => {
      console.error("Socket error:", error);
      alert(error.message || "An error occurred");
    });

    socket.on("connect", () => {
      setConnectionStatus("connected");
      setReconnectAttempts(0);
      console.log("Connected to socket server");

      // Join the room when socket connects
      joinRoom();

      // Start ping interval
      pingIntervalId = startPingInterval();
    });

    // If already connected, join the room immediately
    if (socket.connected) {
      console.log("Socket already connected, joining room immediately");
      joinRoom();
      pingIntervalId = startPingInterval();
    }

    socket.on("disconnect", () => {
      setConnectionStatus("disconnected");
      console.log("Disconnected from socket server");

      // Attempt to reconnect
      if (reconnectAttempts < 3) {
        const timer = setTimeout(() => {
          setReconnectAttempts((prev) => prev + 1);
          socket.connect();
        }, 2000);

        return () => clearTimeout(timer);
      }
    });

    socket.on("user:joined", (id, clients, userData) => {
      console.log(id, clients, userData);
      setConnectionStatus("connected");

      // Update users data if provided
      if (userData) {
        setUsers((prevUsers) => ({
          ...prevUsers,
          ...userData,
        }));
      }

      clients.forEach((socketListId: string) => {
        connections[socketListId] = new RTCPeerConnection(
          peerConfigConnections
        );

        // Add connection error handling through state change events
        connections[socketListId].oniceconnectionstatechange = () => {
          const state = connections[socketListId].iceConnectionState;
          console.log(`ICE connection state with ${socketListId}: ${state}`);

          if (
            state === "failed" ||
            state === "disconnected" ||
            state === "closed"
          ) {
            console.warn(`Connection with peer ${socketListId} is ${state}`);
          }
        };

        connections[socketListId].onicecandidate = function (event) {
          if (event.candidate != null) {
            socket.emit(
              "signal",
              socketListId,
              JSON.stringify({ ice: event.candidate })
            );
          }
        };

        // Fix: Use ontrack instead of onaddstream (deprecated)
        connections[socketListId].ontrack = (event) => {
          const stream = event.streams[0];
          const videoExists = videoRef.current.find(
            (video) => video.socketId === socketListId
          );

          // Get username for this user from the socket user list
          const username =
            users?.[socketListId]?.username ||
            `User-${socketListId.substring(0, 5)}`;

          if (videoExists) {
            //Update the Stream of the existing videos
            setVideos((prevVideos) => {
              // First filter out any potential duplicates
              const filteredVideos = prevVideos.filter(
                (video) => video.socketId !== socketListId
              );

              // Then add the updated video
              const updatedVideo = {
                ...videoExists,
                stream,
                username: username,
                isVideoOn:
                  videoExists.isVideoOn !== undefined
                    ? videoExists.isVideoOn
                    : true,
                isAudioOn:
                  videoExists.isAudioOn !== undefined
                    ? videoExists.isAudioOn
                    : true,
              };

              const updatedVideos = [...filteredVideos, updatedVideo];
              videoRef.current = updatedVideos;
              return updatedVideos;
            });
          } else {
            //Create a new video
            const newVideo = {
              socketId: socketListId,
              stream,
              autoplay: true,
              playsinline: true,
              username: username,
              isVideoOn: true, // Default value, will be updated via media:status events
              isAudioOn: true, // Default value, will be updated via media:status events
            };
            setVideos((prevVideos) => {
              // First filter out any potential duplicates
              const filteredVideos = prevVideos.filter(
                (video) => video.socketId !== socketListId
              );

              const updatedVideos = [...filteredVideos, newVideo];
              videoRef.current = updatedVideos;
              return updatedVideos;
            });
          }
        };

        //Add the local video stream
        if (window.localStream) {
          window.localStream.getTracks().forEach((track) => {
            if (window.localStream) {
              connections[socketListId].addTrack(track, window.localStream);
            }
          });
        } else {
          const blackSilence = () => new MediaStream([black(), silence()]);
          window.localStream = blackSilence();
          window.localStream.getTracks().forEach((track) => {
            if (window.localStream) {
              connections[socketListId].addTrack(track, window.localStream);
            }
          });
        }
      });

      if (id === socket.id) {
        for (const id2 in connections) {
          if (id2 === socket.id) continue;

          try {
            if (window.localStream) {
              window.localStream.getTracks().forEach((track) => {
                if (window.localStream) {
                  connections[id2].addTrack(track, window.localStream);
                }
              });
            }
          } catch (e) {
            console.log(e);
          }

          connections[id2].createOffer().then((description) => {
            connections[id2]
              .setLocalDescription(description)
              .then(() => {
                socket.emit(
                  "signal",
                  id2,
                  JSON.stringify({ sdp: connections[id2].localDescription })
                );
              })
              .catch((e) => console.log(e));
          });
        }
      }
    });

    // Add signal handler
    socket.on("signal", (fromId: string, message: string) => {
      const signal = JSON.parse(message);

      if (fromId !== socket.id) {
        if (signal.sdp) {
          connections[fromId]
            .setRemoteDescription(new RTCSessionDescription(signal.sdp))
            .then(() => {
              if (signal.sdp.type === "offer") {
                connections[fromId]
                  .createAnswer()
                  .then((description) => {
                    connections[fromId]
                      .setLocalDescription(description)
                      .then(() => {
                        socket.emit(
                          "signal",
                          fromId,
                          JSON.stringify({
                            sdp: connections[fromId].localDescription,
                          })
                        );
                      })
                      .catch((e) => console.log(e));
                  })
                  .catch((e) => console.log(e));
              }
            })
            .catch((e) => console.log(e));
        }

        if (signal.ice) {
          connections[fromId]
            .addIceCandidate(new RTCIceCandidate(signal.ice))
            .catch((e) => console.log(e));
        }
      }
    });

    // Add user-left handler
    socket.on("user:left", (id: string) => {
      if (connections[id]) {
        connections[id].close();
        delete connections[id];
      }

      setVideos((prevVideos) => {
        const filteredVideos = prevVideos.filter(
          (video) => video.socketId !== id
        );
        // Update videoRef.current to maintain consistency
        videoRef.current = filteredVideos;
        return filteredVideos;
      });
    });

    // Add pong handler
    socket.on("pong", () => {
      console.log("Received pong from server");
    });

    // Add handler for media status updates from other users
    socket.on(
      "media:status-update",
      (userId, username, isVideoOn, isAudioOn) => {
        console.log(
          `Received media status update from ${userId}: video=${isVideoOn}, audio=${isAudioOn}`
        );

        setVideos((prevVideos) => {
          // Check if we already have this user
          const userExists = prevVideos.some(
            (video) => video.socketId === userId
          );

          if (userExists) {
            // Update existing user's media status
            return prevVideos.map((video) => {
              if (video.socketId === userId) {
                return {
                  ...video,
                  username: username,
                  isVideoOn: isVideoOn,
                  isAudioOn: isAudioOn,
                };
              }
              return video;
            });
          } else {
            // This shouldn't normally happen, but log it if it does
            console.warn(`Received media status for unknown user: ${userId}`);
            return prevVideos;
          }
        });
      }
    );

    return () => {
      // Clear ping interval
      if (pingIntervalId) {
        clearInterval(pingIntervalId);
      }

      socket.off("user:joined");
      socket.off("signal");
      socket.off("user:left");
      socket.off("connect");
      socket.off("disconnect");
      socket.off("pong");
      socket.off("room:joined");
      socket.off("error");
    };
  };

  useEffect(() => {
    // Redirect if no roomId is provided
    if (!roomId) {
      console.error("No roomId provided, redirecting to home");
      navigate("/home");
      return;
    } else {
      console.log("Room component mounted with roomId:", roomId);
      setRoomName(roomId);
    }

    getPermissions();

    // Cleanup function
    return () => {
      // Stop all tracks when component unmounts
      if (window.localStream) {
        window.localStream.getTracks().forEach((track) => track.stop());
        window.localStream = null;
      }
    };
  }, [roomId, navigate]);

  useEffect(() => {
    if (socket && roomId) {
      console.log("Setting up socket connection for room:", roomId);
      setVideo(videoAvailable);
      setAudio(audioAvailable);
      const cleanup = connectToSocketServer();

      return () => {
        // Close all peer connections when component unmounts
        for (const id in connections) {
          if (connections[id]) {
            connections[id].close();
            delete connections[id];
          }
        }

        // Execute any cleanup returned from connectToSocketServer
        if (cleanup) cleanup();
      };
    }
  }, [videoAvailable, audioAvailable, socket, roomId]);

  useEffect(() => {
    if (video !== undefined && audio !== undefined) {
      if ((video && videoAvailable) || (audio && audioAvailable)) {
        navigator.mediaDevices
          .getUserMedia({
            video: video,
            audio: audio,
          })
          .then(getUserMedia)
          .catch((error) => {
            console.error("Error getting user media", error);
          });
      } else {
        try {
          window.localStream?.getTracks().forEach((track) => {
            track.stop();
          });
          window.localStream = null;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
          }
        } catch (e) {
          console.error("Error stopping tracks", e);
        }
      }
    }
  }, [video, audio, videoAvailable, audioAvailable]);

  // Add this new function to track media status changes
  const updateLocalMediaStatus = () => {
    if (!socket || !roomName) return;

    // Send an update about our media status to everyone in the room
    socket.emit("media:status", {
      room: roomName,
      isVideoOn: video,
      isAudioOn: audio,
    });
  };

  // Update toggleVideo and toggleAudio to notify others about status changes
  const toggleVideo = () => {
    setVideo((prev) => {
      const newStatus = !prev;
      // Update tracks if we have a stream
      if (window.localStream) {
        const videoTracks = window.localStream.getVideoTracks();
        if (videoTracks.length > 0) {
          videoTracks.forEach((track) => {
            track.enabled = newStatus;
          });
        }
      }

      // Notify other users about our video status change
      setTimeout(() => updateLocalMediaStatus(), 100);

      return newStatus;
    });
  };

  const toggleAudio = () => {
    setAudio((prev) => {
      const newStatus = !prev;
      // Update tracks if we have a stream
      if (window.localStream) {
        const audioTracks = window.localStream.getAudioTracks();
        if (audioTracks.length > 0) {
          audioTracks.forEach((track) => {
            track.enabled = newStatus;
          });
        }
      }

      // Notify other users about our audio status change
      setTimeout(() => updateLocalMediaStatus(), 100);

      return newStatus;
    });
  };

  const toggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        // Stop screen sharing
        if (window.localStream) {
          window.localStream.getTracks().forEach((track) => {
            if (track.kind === "video") {
              track.stop();
            }
          });
        }

        // Get camera stream again
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: audio,
        });

        window.localStream = cameraStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = cameraStream;
        }

        setIsScreenSharing(false);
      } else {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });

        // When user stops sharing via browser UI
        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
        };

        window.localStream = screenStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        setIsScreenSharing(true);
      }
    } catch (error) {
      console.error("Error toggling screen share:", error);
    }
  };

  const toggleMirror = () => {
    setIsMirrored((prev) => !prev);
  };

  const leaveRoom = () => {
    // Notify server about leaving
    if (socket) {
      socket.emit("leave:room");
    }

    // Stop all tracks
    if (window.localStream) {
      window.localStream.getTracks().forEach((track) => track.stop());
      window.localStream = null;
    }

    // Close all peer connections
    for (const id in connections) {
      if (connections[id]) {
        connections[id].close();
        delete connections[id];
      }
    }

    // Clear videos
    setVideos([]);

    // Navigate to home page
    navigate("/home");
  };

  const copyRoomLink = () => {
    const roomUrl = window.location.href.split("/").slice(4).join("/");
    navigator.clipboard.writeText(roomUrl).then(
      () => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      },
      (err) => {
        console.error("Could not copy text: ", err);
      }
    );
  };

  // Send initial media status when stream is available
  useEffect(() => {
    if (
      socket &&
      socket.connected &&
      videoAvailable !== undefined &&
      audioAvailable !== undefined
    ) {
      updateLocalMediaStatus();
    }
  }, [socket?.connected, videoAvailable, audioAvailable]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-gray-800">
              Room: {roomName}
            </h1>
            <div className="flex items-center space-x-2">
              <span
                className={`inline-block w-3 h-3 rounded-full ${
                  connectionStatus === "connected"
                    ? "bg-green-500"
                    : connectionStatus === "connecting"
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }`}
              ></span>
              <span className="text-sm text-gray-600">{connectionStatus}</span>
            </div>
            <div className="flex items-center space-x-1 rounded-full bg-blue-50 px-3 py-1">
              <Users className="h-4 w-4 text-blue-600 mr-1" />
              <span className="text-sm font-medium text-blue-700">
                {videos.length}{" "}
                {videos.length === 1 ? "participant" : "participants"}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={copyRoomLink}
              className="px-3 py-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors flex items-center text-sm font-medium"
            >
              {copySuccess ? "Copied!" : "Copy Link"}
              <ClipboardCopy className="h-4 w-4 ml-2" />
            </button>
            <button
              onClick={leaveRoom}
              className="px-3 py-2 bg-red-50 text-red-700 rounded-md hover:bg-red-100 transition-colors flex items-center text-sm font-medium"
            >
              Leave
              <LogOut className="h-4 w-4 ml-2" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
          {/* Local Video */}
          <div className="mb-6">
            <div className="relative w-full max-w-md mx-auto overflow-hidden rounded-lg shadow-md border border-gray-200">
              {video ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  className={`w-full h-80 bg-black ${
                    isMirrored ? "scale-x-[-1]" : ""
                  }`}
                ></video>
              ) : (
                <div
                  className={`w-full h-80 aspect-video bg-gray-800 flex flex-col items-center justify-center p-4 ${
                    isMirrored ? "scale-x-[-1]" : ""
                  }`}
                >
                  <div
                    className={`w-24 h-24 rounded-full flex items-center justify-center mb-3 text-white text-4xl font-semibold uppercase shadow-lg ${
                      isMirrored ? "scale-x-[-1]" : ""
                    }`}
                    style={{
                      background: `linear-gradient(to bottom right, ${
                        getAvatarColors(
                          localStorage.getItem("username") ||
                            socket?.id ||
                            "default"
                        ).from
                      }, ${
                        getAvatarColors(
                          localStorage.getItem("username") ||
                            socket?.id ||
                            "default"
                        ).to
                      })`,
                    }}
                  >
                    {localStorage.getItem("username")
                      ? localStorage.getItem("username")?.charAt(0)
                      : "U"}
                  </div>
                  <span
                    className={`text-white text-lg font-medium ${
                      isMirrored ? "scale-x-[-1]" : ""
                    }`}
                  >
                    {localStorage.getItem("username") || "You"}
                  </span>
                  {!audio && (
                    <div
                      className={`mt-2 flex items-center ${
                        isMirrored ? "scale-x-[-1]" : ""
                      }`}
                    ></div>
                  )}
                </div>
              )}

              {/* Video Controls */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-3">
                <button
                  onClick={toggleVideo}
                  className={`p-2.5 rounded-full flex items-center justify-center ${
                    video
                      ? "bg-blue-500 text-white hover:bg-blue-600"
                      : "bg-red-500 text-white hover:bg-red-600"
                  } transition-colors shadow-lg`}
                  title={video ? "Turn Off Video" : "Turn On Video"}
                >
                  {video ? (
                    <Video className="h-5 w-5" />
                  ) : (
                    <VideoOff className="h-5 w-5" />
                  )}
                </button>
                <button
                  onClick={toggleAudio}
                  className={`p-2.5 rounded-full flex items-center justify-center ${
                    audio
                      ? "bg-blue-500 text-white hover:bg-blue-600"
                      : "bg-red-500 text-white hover:bg-red-600"
                  } transition-colors shadow-lg`}
                  title={audio ? "Mute Audio" : "Unmute Audio"}
                >
                  {audio ? (
                    <Mic className="h-5 w-5" />
                  ) : (
                    <MicOff className="h-5 w-5" />
                  )}
                </button>
                {screenShareAvailable && (
                  <button
                    onClick={toggleScreenShare}
                    className={`p-2.5 rounded-full flex items-center justify-center ${
                      isScreenSharing
                        ? "bg-green-500 text-white hover:bg-green-600"
                        : "bg-blue-500 text-white hover:bg-blue-600"
                    } transition-colors shadow-lg`}
                    title={
                      isScreenSharing ? "Stop Sharing Screen" : "Share Screen"
                    }
                  >
                    <MonitorSmartphone className="h-5 w-5" />
                  </button>
                )}
                <button
                  onClick={toggleMirror}
                  className={`p-2.5 rounded-full flex items-center justify-center ${
                    isMirrored
                      ? "bg-purple-500 text-white hover:bg-purple-600"
                      : "bg-gray-500 text-white hover:bg-gray-600"
                  } transition-colors shadow-lg`}
                  title={
                    isMirrored ? "Disable Mirror View" : "Enable Mirror View"
                  }
                >
                  <FlipHorizontal className="h-5 w-5" />
                </button>
              </div>

              {/* Status Indicators */}
              <div className="absolute top-2 left-2 flex flex-col space-y-1">
                {isScreenSharing && (
                  <div className="bg-green-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center">
                    <MonitorSmartphone className="h-3 w-3 mr-1" />
                    Sharing Screen
                  </div>
                )}
              </div>

              {isMirrored && video && !isScreenSharing && (
                <div className="absolute top-2 right-2 bg-purple-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center">
                  <FlipHorizontal className="h-3 w-3 mr-1" />
                  Mirrored
                </div>
              )}

              {!videoAvailable && !audioAvailable && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 text-white">
                  <div className="text-center px-4">
                    <p className="mb-2 font-medium">
                      Camera and microphone access denied
                    </p>
                    <p className="text-sm text-gray-300">
                      Please check your browser permissions
                    </p>
                  </div>
                </div>
              )}

              <div className="absolute top-2 right-2 text-xs font-medium text-white bg-black bg-opacity-50 px-2 py-1 rounded">
                You
              </div>
            </div>
          </div>

          {/* Remote Participants */}
          {videos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {videos.map((videoItem, index) => (
                <div
                  key={`${videoItem.socketId}-${index}`}
                  className="aspect-video relative rounded-lg overflow-hidden shadow-md border border-gray-200"
                >
                  {videoItem.isVideoOn !== false ? (
                    <video
                      ref={(ref) => {
                        if (ref && videoItem.stream) {
                          ref.srcObject = videoItem.stream;
                        }
                      }}
                      autoPlay
                      playsInline
                      className="w-full h-full bg-black object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex flex-col items-center justify-center p-4">
                      <div
                        className="w-24 h-24 rounded-full flex items-center justify-center mb-3 text-white text-4xl font-semibold uppercase shadow-lg"
                        style={{
                          background: `linear-gradient(to bottom right, ${
                            getAvatarColors(
                              videoItem.username || videoItem.socketId
                            ).from
                          }, ${
                            getAvatarColors(
                              videoItem.username || videoItem.socketId
                            ).to
                          })`,
                        }}
                      >
                        {videoItem.username
                          ? videoItem.username.charAt(0)
                          : videoItem.socketId.substring(0, 1)}
                      </div>
                      <span className="text-white text-lg font-medium">
                        {videoItem.username ||
                          `User-${videoItem.socketId.substring(0, 5)}`}
                      </span>
                      <div className="mt-2 flex items-center space-x-2">
                        {videoItem.isAudioOn === false ? (
                          <span className="px-2 py-1 bg-red-500 text-white text-xs rounded-full flex items-center">
                            <MicOff className="h-3 w-3 mr-1" />
                            Muted
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-green-500 text-white text-xs rounded-full flex items-center">
                            <Mic className="h-3 w-3 mr-1" />
                            Unmuted
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Video and audio status indicators */}
                  <div className="absolute top-2 right-2 flex space-x-1">
                    {videoItem.isVideoOn === false && (
                      <div className="bg-red-500 text-white p-1 rounded-full">
                        <VideoOff className="h-3 w-3" />
                      </div>
                    )}
                    {videoItem.isAudioOn === false &&
                      videoItem.isVideoOn !== false && (
                        <div className="bg-red-500 text-white p-1 rounded-full">
                          <MicOff className="h-3 w-3" />
                        </div>
                      )}
                  </div>

                  <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white px-2 py-1 rounded text-sm font-medium">
                    {videoItem.username ||
                      `User-${videoItem.socketId.substring(0, 5)}`}
                  </div>
                </div>
              ))}
            </div>
          ) : connectionStatus === "connected" ? (
            <div className="text-center py-12 px-4 bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="max-w-md mx-auto">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Waiting for others to join
                </h3>
                <p className="text-gray-500 mb-6">
                  Share the link with others to invite them to this room
                </p>
                <button
                  onClick={copyRoomLink}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors inline-flex items-center"
                >
                  {copySuccess ? "Copied!" : "Copy Room Link"}
                  <ClipboardCopy className="h-4 w-4 ml-2" />
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 px-4 bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="max-w-md mx-auto">
                <h3 className="text-lg font-medium text-yellow-800 mb-2">
                  Connecting to the room...
                </h3>
                <p className="text-gray-500">
                  Please wait while we establish the connection
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Room;
