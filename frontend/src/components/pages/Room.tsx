import { useEffect, useRef, useState } from "react";
import { useSocket } from "../contexts/SocketProvider";
import { useParams, useNavigate } from "react-router-dom";

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
}

const peerConfigConnections = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// Fix: Using an object instead of array for connections
const connections: Record<string, RTCPeerConnection> = {};

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
  // const [screenAvailable, setScreenAvailable] = useState(false);

  const getPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      // const hasVideo = stream.getVideoTracks().length > 0;
      // const hasAudio = stream.getAudioTracks().length > 0;
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
        socket.emit("join:room", {
          room: roomName,
          username: localStorage.getItem("username") || undefined,
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

    // Handle successful room joining
    socket.on("room:joined", (data) => {
      console.log("Successfully joined room:", data);
      setConnectionStatus("connected");
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

    socket.on("user:joined", (id, clients) => {
      console.log(id, clients);
      setConnectionStatus("connected");

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

          if (videoExists) {
            //Update the Stream of the existing videos
            setVideos((videos) => {
              const updatedVideos = videos.map((video) =>
                video.socketId === socketListId ? { ...video, stream } : video
              );
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
            };
            setVideos((videos) => {
              const updatedVideos = [...videos, newVideo];
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

      setVideos((videos) => videos.filter((video) => video.socketId !== id));
    });

    // Add pong handler
    socket.on("pong", () => {
      console.log("Received pong from server");
    });

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
            video: video ? true : false,
            audio: audio ? true : false,
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

  const toggleVideo = () => {
    setVideo((prev) => !prev);
  };

  const toggleAudio = () => {
    setAudio((prev) => !prev);
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
    navigate("/");
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

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Video Room: {roomName}</h1>

      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center">
          <span
            className={`inline-block w-3 h-3 rounded-full mr-2 ${
              connectionStatus === "connected"
                ? "bg-green-500"
                : connectionStatus === "connecting"
                ? "bg-yellow-500"
                : "bg-red-500"
            }`}
          ></span>
          <span className="text-sm">
            {connectionStatus === "connected"
              ? "Connected"
              : connectionStatus === "connecting"
              ? "Connecting..."
              : "Disconnected"}
          </span>
          <span className="ml-4 text-sm">
            {videos.length}{" "}
            {videos.length === 1 ? "participant" : "participants"} in call
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={copyRoomLink}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center"
          >
            {copySuccess ? "Copied!" : "Copy Room Link"}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 ml-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
            </svg>
          </button>
          <button
            onClick={leaveRoom}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            Leave Room
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative w-full max-w-md mb-4">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            className="w-full h-auto border rounded"
          ></video>
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
            <button
              onClick={toggleVideo}
              className={`px-4 py-2 rounded-full flex items-center justify-center w-12 h-12 ${
                video ? "bg-blue-500 text-white" : "bg-red-500 text-white"
              }`}
              title={video ? "Turn Off Video" : "Turn On Video"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {video ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  />
                )}
              </svg>
            </button>
            <button
              onClick={toggleAudio}
              className={`px-4 py-2 rounded-full flex items-center justify-center w-12 h-12 ${
                audio ? "bg-blue-500 text-white" : "bg-red-500 text-white"
              }`}
              title={audio ? "Mute Audio" : "Unmute Audio"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {audio ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                    strokeDasharray="2 2"
                  />
                )}
              </svg>
            </button>
            {screenShareAvailable && (
              <button
                onClick={toggleScreenShare}
                className={`px-4 py-2 rounded-full flex items-center justify-center w-12 h-12 ${
                  isScreenSharing
                    ? "bg-green-500 text-white"
                    : "bg-blue-500 text-white"
                }`}
                title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </button>
            )}
          </div>
          {!videoAvailable && !audioAvailable && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white">
              <p>
                Camera and microphone access denied. Please check your browser
                permissions.
              </p>
            </div>
          )}
          {isScreenSharing && (
            <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-sm">
              Screen Sharing
            </div>
          )}
        </div>
      </div>

      {videos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((videoItem) => (
            <div key={videoItem.socketId} className="aspect-video relative">
              <video
                ref={(ref) => {
                  if (ref && videoItem.stream) {
                    ref.srcObject = videoItem.stream;
                  }
                }}
                autoPlay
                playsInline
                className="w-full h-full border rounded"
              />
              <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                Participant {videoItem.socketId.substring(0, 5)}
              </div>
            </div>
          ))}
        </div>
      )}

      {videos.length === 0 && connectionStatus === "connected" && (
        <div className="text-center p-8 bg-gray-100 rounded">
          <p className="text-lg">Waiting for others to join the call...</p>
          <p className="text-sm text-gray-500 mt-2">
            Share the URL with others to invite them to this room
          </p>
        </div>
      )}
    </div>
  );
}

export default Room;
