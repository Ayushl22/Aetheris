import { useEffect, useRef, useState } from "react";
import { createSocket } from "../services/socket.service";

export function useSocket(onJobEvent) {
  const callbackRef = useRef(onJobEvent);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    callbackRef.current = onJobEvent;
  }, [onJobEvent]);

  useEffect(() => {
    const token = localStorage.getItem("aetheris_token");
    if (!token) {
      setConnected(false);
      return undefined;
    }

    const socket = createSocket(token);

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);
    const handleEvent = (event) => callbackRef.current?.(event);

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    const handleConnectError = () => setConnected(false);
    socket.on("connect_error", handleConnectError);
    socket.on("job-event", handleEvent);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("job-event", handleEvent);
      socket.disconnect();
    };
  }, []);

  return connected;
}
