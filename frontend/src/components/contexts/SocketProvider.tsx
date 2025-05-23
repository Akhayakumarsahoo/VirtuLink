import React, {
  createContext,
  useMemo,
  useContext,
  ReactNode,
  useEffect,
  useState,
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
  const [isConnected, setIsConnected] = useState(false);

  const socket = useMemo(() => {
    return io(
      import.meta.env.MODE === "development"
        ? "http://localhost:8000"
        : "https://virtulink.onrender.com",
      {
        reconnection: false,
        autoConnect: false,
        timeout: 10000,
      }
    );
  }, []);

  useEffect(() => {
    if (!socket.connected && !isConnected) {
      socket.connect();
    }

    const onConnect = () => {
      setIsConnected(true);
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onConnectError = (error: Error) => {
      console.error("Socket connection error:", error);
      setIsConnected(false);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      if (socket.connected) {
        socket.disconnect();
      }
    };
  }, [socket, isConnected]);

  return (
    <SocketContext.Provider value={socket}>
      {props.children}
    </SocketContext.Provider>
  );
};
