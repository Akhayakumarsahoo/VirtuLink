import React, {
  createContext,
  useMemo,
  useContext,
  ReactNode,
  useEffect,
} from "react";
import { io, Socket } from "socket.io-client";

type SocketContextType = Socket | null;

const SocketContext = createContext<SocketContextType>(null);

export const useSocket = (): SocketContextType => {
  const socket = useContext(SocketContext);
  return socket;
};

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = (props) => {
  console.log("Initializing SocketProvider");

  const socket = useMemo(() => {
    console.log("Creating socket connection to http://localhost:9000");
    return io("http://localhost:9000", {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      autoConnect: true,
      timeout: 10000,
    });
  }, []);

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Socket connected successfully with ID:", socket.id);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });

    // Force a connection attempt if not already connected
    if (!socket.connected) {
      console.log("Socket not connected, attempting to connect...");
      socket.connect();
    } else {
      console.log("Socket already connected with ID:", socket.id);
    }

    return () => {
      console.log("Cleaning up socket event listeners");
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={socket}>
      {props.children}
    </SocketContext.Provider>
  );
};
