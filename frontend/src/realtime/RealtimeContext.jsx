import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient as useQueryGuest } from "@tanstack/react-query";
import { API_BASE } from "../api/guest.js";

const RealtimeContext = createContext(null);

function websocketUrl(token) {
  const url = new URL(API_BASE, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/api/ws";
  url.search = token
    ? `?token=${encodeURIComponent(token)}`
    : "?public=true";
  return url.toString();
}

export function RealtimeProvider({ children }) {
  const queryGuest = useQueryGuest();
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const heartbeatRef = useRef(null);
  const pongTimeoutRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const manuallyClosedRef = useRef(false);
  const [authVersion, setAuthVersion] = useState(0);
  const [connectionState, setConnectionState] = useState("disconnected");
  const [onlineUserIds, setOnlineUserIds] = useState(() => new Set());
  const [lastDataUpdate, setLastDataUpdate] = useState(null);

  useEffect(() => {
    const handleAuthChange = () => setAuthVersion((value) => value + 1);
    window.addEventListener("qf:auth-changed", handleAuthChange);
    window.addEventListener("storage", handleAuthChange);
    return () => {
      window.removeEventListener("qf:auth-changed", handleAuthChange);
      window.removeEventListener("storage", handleAuthChange);
    };
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem("qf_admin_token");
    const publicParams = new URLSearchParams(window.location.search);
    const isPublicEventPage = Boolean(
      publicParams.get("q") || publicParams.get("project") ||
      [...publicParams.entries()].some(([key, value]) => key && !value),
    );
    if (!token && !isPublicEventPage) {
      setConnectionState("disconnected");
      setOnlineUserIds(new Set());
      return undefined;
    }

    manuallyClosedRef.current = false;

    const clearTimers = () => {
      clearTimeout(reconnectTimerRef.current);
      clearInterval(heartbeatRef.current);
      clearTimeout(pongTimeoutRef.current);
    };

    const connect = () => {
      if (manuallyClosedRef.current) return;
      setConnectionState("connecting");
      const socket = new WebSocket(websocketUrl(token));
      socketRef.current = socket;

      socket.onopen = () => {
        reconnectAttemptRef.current = 0;
        setConnectionState("connected");
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(() => {
          if (socket.readyState !== WebSocket.OPEN) return;
          socket.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
          clearTimeout(pongTimeoutRef.current);
          pongTimeoutRef.current = setTimeout(() => socket.close(4000, "Heartbeat timeout"), 10_000);
        }, 25_000);
      };

      socket.onmessage = (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }

        if (message.type === "pong") {
          clearTimeout(pongTimeoutRef.current);
          return;
        }
        if (message.type === "presence_snapshot") {
          setOnlineUserIds(new Set((message.online_user_ids || []).map(String)));
          return;
        }
        if (message.type === "status_change") {
          setOnlineUserIds((current) => {
            const next = new Set(current);
            if (message.status === "online") next.add(String(message.user_id));
            else next.delete(String(message.user_id));
            return next;
          });
          return;
        }
        if (message.type === "data_update") {
          setLastDataUpdate(message);
          queryGuest.invalidateQueries();
          window.dispatchEvent(new CustomEvent("qf:data-update", { detail: message }));
        }
      };

      socket.onerror = () => socket.close();
      socket.onclose = (event) => {
        clearInterval(heartbeatRef.current);
        clearTimeout(pongTimeoutRef.current);
        if (socketRef.current === socket) socketRef.current = null;
        setConnectionState("disconnected");
        if (manuallyClosedRef.current || event.code === 1008) return;

        const attempt = reconnectAttemptRef.current++;
        const baseDelay = Math.min(30_000, 1_000 * (2 ** attempt));
        const delay = baseDelay + Math.floor(Math.random() * 500);
        reconnectTimerRef.current = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      manuallyClosedRef.current = true;
      clearTimers();
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.close(1000, "Guest closed");
      } else if (socket?.readyState === WebSocket.CONNECTING) {
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.onopen = () => socket.close(1000, "Guest closed");
      }
    };
  }, [authVersion, queryGuest]);

  const isUserOnline = useCallback(
    (userId) => onlineUserIds.has(String(userId)),
    [onlineUserIds],
  );

  const value = useMemo(
    () => ({ connectionState, onlineUserIds, isUserOnline, lastDataUpdate }),
    [connectionState, onlineUserIds, isUserOnline, lastDataUpdate],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) throw new Error("useRealtime must be used inside RealtimeProvider");
  return context;
}

export function useRealtimeRefresh(resources, callback) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const resourceKey = Array.isArray(resources) ? resources.join(",") : resources;

  useEffect(() => {
    const accepted = new Set(resourceKey.split(",").filter(Boolean));
    const handleDataUpdate = (event) => {
      if (accepted.has(event.detail?.resource)) callbackRef.current(event.detail);
    };
    window.addEventListener("qf:data-update", handleDataUpdate);
    return () => window.removeEventListener("qf:data-update", handleDataUpdate);
  }, [resourceKey]);
}
