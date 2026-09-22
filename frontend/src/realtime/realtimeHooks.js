import { useContext, useEffect, useRef } from "react";
import RealtimeContext from "./realtimeStore.js";

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
