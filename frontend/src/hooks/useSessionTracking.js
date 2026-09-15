import { useCallback, useEffect, useRef } from "react";
import { API_BASE, startPerfSession, perfHeartbeat, endPerfSession } from "../api/guest.js";

export default function useSessionTracking(enabled) {
  const sessionIdRef = useRef(null);

  const endCurrentSession = useCallback(() => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    sessionIdRef.current = null;
    sessionStorage.removeItem("qf_perf_session_id");
    endPerfSession(sessionId).catch(() => {});
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;
    let throttle = false;

    startPerfSession().then((res) => {
      if (cancelled) return;
      sessionIdRef.current = res.data.session_id;
      sessionStorage.setItem("qf_perf_session_id", String(res.data.session_id));
    }).catch(() => {});

    function throttledActivity() {
      if (throttle || !sessionIdRef.current) return;
      throttle = true;
      perfHeartbeat(sessionIdRef.current).then((response) => {
        const nextSessionId = response.data?.session_id;
        if (nextSessionId && nextSessionId !== sessionIdRef.current) {
          sessionIdRef.current = nextSessionId;
          sessionStorage.setItem("qf_perf_session_id", String(nextSessionId));
        }
      }).catch(() => {});
      setTimeout(() => (throttle = false), 30000);
    }
    window.addEventListener("pointerdown", throttledActivity);
    window.addEventListener("keydown", throttledActivity);
    window.addEventListener("input", throttledActivity);
    window.addEventListener("change", throttledActivity);
    window.addEventListener("submit", throttledActivity);

    function handleUnload() {
      const sessionId = sessionIdRef.current;
      const token = sessionStorage.getItem("qf_admin_token");
      if (!sessionId || !token) return;
      fetch(`${API_BASE}/api/performance/session/${sessionId}/end`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        keepalive: true,
      }).catch(() => {});
    }
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", throttledActivity);
      window.removeEventListener("keydown", throttledActivity);
      window.removeEventListener("input", throttledActivity);
      window.removeEventListener("change", throttledActivity);
      window.removeEventListener("submit", throttledActivity);
      window.removeEventListener("beforeunload", handleUnload);
      endCurrentSession();
    };
  }, [enabled, endCurrentSession]);

  return endCurrentSession;
}
