import { useEffect, useRef, useState } from "react";
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
import { useAuth } from "../contexts/AuthContext";
import { io, Socket } from "socket.io-client";
declare global {
  interface Window {
    localStream: MediaStream | null;
  }
}

interface VideoItem {
  socketId: string;
  stream: MediaStream;
  username?: string;
  isVideoOn?: boolean;
  isAudioOn?: boolean;
}

const peerConfigConnections: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const connections: Record<string, RTCPeerConnection> = {};

const getAvatarColors = (identifier: string) => {
  const hash = identifier.split("").reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  const h = Math.abs(hash) % 360;
  return {
    from: `hsl(${h}, 70%, 50%)`,
    to: `hsl(${(h + 30) % 360}, 70%, 45%)`,
  };
};

function Room() {
  const socket = useRef<Socket | null>(null);
  const socketIdRef = useRef<string | undefined>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [videoAvailable, setVideoAvailable] = useState(false);
  const [audioAvailable, setAudioAvailable] = useState(false);
  const [video, setVideo] = useState<boolean>(false);
  const [audio, setAudio] = useState<boolean>(false);

  const { roomId } = useParams<{ roomId: string }>();
  const authContext = useAuth();
  const userData = authContext?.userData;
  const navigate = useNavigate();

  const [videos, setVideos] = useState<VideoItem[]>([]);
  const videoRef = useRef<VideoItem[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("disconnected");
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [screenShareAvailable, setScreenShareAvailable] =
    useState<boolean>(false);
  const [isMirrored, setIsMirrored] = useState<boolean>(true);
  const [users, setUsers] = useState<
    Record<string, { username: string; offer: object }>
  >({});

  const getPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      setVideoAvailable(true);
      setAudioAvailable(true);
      setVideo(true);
      setAudio(true);

      // Store stream globally and set it to video elemen
      window.localStream = stream;

      // Check screen share capability
      setScreenShareAvailable(!!navigator.mediaDevices.getDisplayMedia);
    } catch (error) {
      console.error("Error getting permissions:", error);
      setVideoAvailable(false);
      setAudioAvailable(false);
      setVideo(false);
      setAudio(false);
    }
  };

  // Effect to handle video element setup
  useEffect(() => {
    (async () => {
      if (localVideoRef.current && window.localStream) {
        localVideoRef.current.srcObject = window.localStream;
      }
    })();
  }, [localVideoRef.current?.srcObject, window.localStream]);

  useEffect(() => {
    getUserMedia();
  }, [video, audio]);

  const getUserMedia = () => {
    if ((video && videoAvailable) || (audio && audioAvailable)) {
      navigator.mediaDevices
        .getUserMedia({ video: video, audio: audio })
        .then(getUserMediaSuccess)
        .catch((e) => console.log(e));
    } else {
      try {
        window.localStream?.getVideoTracks().forEach((track) => track.stop());
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
        }
      } catch (e) {
        console.log(e);
      }
    }
  };

  const getUserMediaSuccess = (stream: MediaStream) => {
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
      if (id === socketIdRef.current) continue;

      window.localStream?.getTracks().forEach((track) => {
        connections[id].addTrack(track, window.localStream!);
      });

      connections[id].createOffer().then((description) => {
        console.log(description);
        connections[id]
          .setLocalDescription(description)
          .then(() => {
            socket.current?.emit(
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
            window.localStream
              ?.getVideoTracks()
              .forEach((track) => track.stop());
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = null;
            }
          } catch (e) {
            console.log(e);
          }

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = window.localStream;
          }

          for (const id in connections) {
            window.localStream?.getTracks().forEach((track) => {
              connections[id].addTrack(track, window.localStream!);
            });

            connections[id].createOffer().then((description) => {
              connections[id]
                .setLocalDescription(description)
                .then(() => {
                  socket.current?.emit(
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

  const updateLocalMediaStatus = () => {
    if (!socket || !roomId) return;
    socket.current?.emit("media:status", {
      room: roomId,
      isVideoOn: video,
      isAudioOn: audio,
    });
  };

  const handleVideoToggle = async () => {
    setVideo((prev) => {
      const newStatus = !prev;

      if (newStatus) {
        // Turn on video
        navigator.mediaDevices
          .getUserMedia({ video: true, audio: audio })
          .then((stream) => {
            if (window.localStream) {
              window.localStream
                .getVideoTracks()
                .forEach((track) => track.stop());
            }
            window.localStream = stream;
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
            }
          })
          .catch((error) => {
            console.error("Error starting video:", error);
            setVideo(false);
          });
      } else {
        // Turn off video
        if (window.localStream) {
          window.localStream.getVideoTracks().forEach((track) => track.stop());
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
          }
        }
      }
      // Notify other users about our video status change
      setTimeout(() => updateLocalMediaStatus(), 100);
      return newStatus;
    });
  };

  const handleAudioToggle = async () => {
    setAudio((prev) => {
      const newStatus = !prev;

      if (newStatus) {
        // Turn on audio
        navigator.mediaDevices
          .getUserMedia({ video: video, audio: true })
          .then((stream) => {
            if (window.localStream) {
              window.localStream.getTracks().forEach((track) => track.stop());
            }
            window.localStream = stream;
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
            }
          })
          .catch((error) => {
            console.error("Error starting audio:", error);
            setAudio(false);
          });
      } else {
        // Turn off audio
        if (window.localStream) {
          window.localStream.getAudioTracks().forEach((track) => track.stop());
        }
      }
      // Notify other users about our Audio status change
      setTimeout(() => updateLocalMediaStatus(), 100);
      return newStatus;
    });
  };

  const toggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
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
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        screenStream.getVideoTracks()[0].onended = () =>
          // setIsScreenSharing(false);
          (window.localStream = screenStream);
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
    if (socket) socket.current?.emit("leave:room");
    if (window.localStream) {
      window.localStream.getTracks().forEach((track) => track.stop());
      window.localStream = null;
    }
    Object.values(connections).forEach((conn) => conn.close());
    setVideos([]);
    navigate("/home");
  };

  const copyRoomLink = () => {
    const roomUrl = window.location.href.split("/").slice(4).join("/");
    navigator.clipboard
      .writeText(roomUrl)
      .then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      })
      .catch((err) => console.error("Could not copy text: ", err));
  };

  // Initialize socket connection
  useEffect(() => {
    console.log("Hello1");

    getPermissions();

    socket.current = io(
      import.meta.env.VITE_API_URL || "http://localhost:9000",
      {
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      }
    );

    setVideo(videoAvailable);
    setAudio(audioAvailable);

    connectToSocketServer();

    return () => {
      if (socket.current) {
        socket.current.disconnect();
      }
    };
  }, []);

  const gotMsgFromServer = (fromId: string, message: string) => {
    if (fromId === socketIdRef.current) return;

    console.log(fromId);

    const signal = JSON.parse(message);

    if (signal.sdp) {
      connections[fromId]
        .setRemoteDescription(new RTCSessionDescription(signal.sdp))
        .then(async () => {
          if (signal.sdp.type === "offer") {
            const answer = await connections[fromId].createAnswer();
            await connections[fromId].setLocalDescription(answer);
            socket.current?.emit(
              "signal",
              fromId,
              JSON.stringify({ sdp: connections[fromId].localDescription })
            );
          }
        })

        .catch((e) => console.log(e));
    }
    if (signal.ice) {
      connections[fromId]
        .addIceCandidate(new RTCIceCandidate(signal.ice))
        .catch((e) => console.log(e));
    }
  };

  // Handle socket events
  const connectToSocketServer = () => {
    if (!socket || !roomId) return;

    socket.current?.on("signal", gotMsgFromServer);
    socket.current?.on("connect", async () => {
      socketIdRef.current = socket.current?.id;
      setConnectionStatus("connected");

      socket.current?.emit("join:room", {
        room: roomId,
        username: userData?.name || "User",
      });

      socket.current?.on("disconnect", () => {
        setConnectionStatus("disconnected");
        console.log(`User ${socket.current?.id} disconnected`);
      });

      socket.current?.on("user:joined", async (id, clients, roomUsers) => {
        console.log(`User ${id} joined in the room!`);

        setUsers((prev) => ({ ...prev, ...roomUsers }));

        clients.forEach((socketId: string) => {
          connections[socketId] = new RTCPeerConnection(peerConfigConnections);
          connections[socketId].onicecandidate = function (event) {
            if (event.candidate != null) {
              socket.current?.emit(
                "signal",
                socketId,
                JSON.stringify({ ice: event.candidate })
              );
            }
          };

          connections[socketId].ontrack = (event) => {
            const stream = event.streams[0];
            const username =
              users?.[socketId]?.username || `User-${socketId.substring(0, 5)}`;

            // Check if the stream has video tracks
            const hasVideoTracks = stream.getVideoTracks().length > 0;
            const hasAudioTracks = stream.getAudioTracks().length > 0;

            // Add track ended handlers
            stream.getTracks().forEach((track) => {
              track.onended = () => {
                setVideos((prev) =>
                  prev.map((v) => {
                    if (v.socketId === socketId) {
                      const updatedStream = v.stream;
                      return {
                        ...v,
                        isVideoOn: updatedStream.getVideoTracks().length > 0,
                        isAudioOn: updatedStream.getAudioTracks().length > 0,
                      };
                    }
                    return v;
                  })
                );
              };
            });

            setVideos((prev) => {
              const filtered = prev.filter((v) => v.socketId !== socketId);
              const newVideo = {
                socketId,
                stream,
                username,
                isVideoOn: hasVideoTracks,
                isAudioOn: hasAudioTracks,
              };
              videoRef.current = [...filtered, newVideo];
              return [...filtered, newVideo];
            });
          };

          if (window.localStream) {
            window.localStream.getTracks().forEach((track) => {
              connections[socketId].addTrack(track, window.localStream!);
            });
          }
        });
        setTimeout(async () => {
          if (id === socketIdRef.current) {
            for (const id2 in connections) {
              if (id2 === socketIdRef.current) continue;

              try {
                window.localStream?.getTracks().forEach((track) => {
                  connections[id2].addTrack(track);
                });
              } catch (e) {
                console.log(e);
              }

              const offer = await connections[id2].createOffer();
              connections[id2].setLocalDescription(offer);
              console.log("offer:", offer);

              socket.current?.emit(
                "signal",
                id2,
                JSON.stringify({ sdp: connections[id2].localDescription })
              );
            }
          }
        }, 500);
      });

      socket.current?.on("user:left", (id: string) => {
        if (connections[id]) {
          connections[id].close();
          delete connections[id];
        }
        setVideos((prev) => prev.filter((v) => v.socketId !== id));
      });

      socket.current?.on(
        "media:status-update",
        (userId, username, isVideoOn, isAudioOn) => {
          setVideos((prev) =>
            prev.map((v) =>
              v.socketId === userId
                ? { ...v, username, isVideoOn, isAudioOn }
                : v
            )
          );
        }
      );
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-gray-800">
              Room: {roomId}
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
                          userData?.name ||
                            // socket?.id ||
                            "default"
                        ).from
                      }, ${
                        getAvatarColors(
                          userData?.name ||
                            // socket?.id ||
                            "default"
                        ).to
                      })`,
                    }}
                  >
                    {userData ? userData.name.charAt(0) : "U"}
                  </div>
                  <span
                    className={`text-white text-lg font-medium ${
                      isMirrored ? "scale-x-[-1]" : ""
                    }`}
                  >
                    {userData?.name || "You"}
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
                  onClick={() => handleVideoToggle()}
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
                  onClick={() => handleAudioToggle()}
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
                  onClick={() => setIsMirrored((prev) => !prev)}
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
                  {videoItem.isVideoOn ? (
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
                        {!videoItem.isAudioOn ? (
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
                    {!videoItem.isVideoOn && (
                      <div className="bg-red-500 text-white p-1 rounded-full">
                        <VideoOff className="h-3 w-3" />
                      </div>
                    )}
                    {!videoItem.isAudioOn && (
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
