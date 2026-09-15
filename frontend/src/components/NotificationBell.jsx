// frontend/src/components/NotificationBell.jsx — new file
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listNotifications, getUnreadCount, markNotificationRead } from "../api/guest.js";
import { useRealtimeRefresh } from "../realtime/RealtimeContext.jsx";

const INITIAL_VISIBLE_COUNT = 8;

const FALLBACK_ROUTES = {
  task_assigned: "/admin/tasks",
  report_submitted: "/admin/reports",
  report_feedback: "/admin/reports",
  access_granted: "/admin/events",
  reminder: "/admin/tasks",
};

export default function NotificationBell({ placement = "sidebar" }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const refreshCount = () => {
      getUnreadCount()
        .then((response) => setCount(response.data.count))
        .catch(() => setCount(0));
    };
    refreshCount();
    const id = setInterval(refreshCount, 30000);
    return () => clearInterval(id);
  }, []);

  useRealtimeRefresh(["notifications"], () => {
    getUnreadCount().then((response) => setCount(response.data.count));
    if (open) listNotifications().then((response) => setItems(response.data));
  });

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    setShowAll(false);
    if (next) {
      try {
        const res = await listNotifications();
        setItems(res.data);
      } catch {
        setItems([]);
      } finally {
        setLoaded(true);
      }
    }
  }

  async function handleNotificationClick(notification) {
    if (!notification.is_read) {
      setItems((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, is_read: true } : item
        )
      );
      setCount((current) => Math.max(0, current - 1));
      try {
        await markNotificationRead(notification.id);
      } catch {
        // Navigation should still work if the read receipt cannot be saved.
      }
    }

    const destination =
      notification.target_url ||
      FALLBACK_ROUTES[notification.type] ||
      "/admin";
    setOpen(false);
    navigate(destination);
  }

  const visibleItems = showAll
    ? items
    : items.slice(0, INITIAL_VISIBLE_COUNT);
  const hiddenCount = Math.max(0, items.length - INITIAL_VISIBLE_COUNT);

  return (
    <div className="relative" ref={ref}>
      <button onClick={handleToggle} className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[#D0D5DD] bg-white transition-colors hover:border-[#84ADFF] hover:bg-[#EEF4FF]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 text-[#344054]">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#D92D20] px-1 text-[10px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
          <div className="absolute z-50 w-72 rounded-xl border border-[#E4E7EC] bg-white shadow-lg"
            style={placement === "topbar" ? {
              top: "calc(100% + 10px)",
              right: 0,
            } : {
              bottom: "calc(100% + 8px)",
              right: "auto",
              left: "50%",
              transform: "translateX(-50%)",
              ...(typeof window !== "undefined" && (() => {
                const btn = ref.current?.getBoundingGuestRect();
                if (!btn) return {};
                const spaceRight = window.innerWidth - btn.left;
                const spaceLeft = btn.right;
                if (spaceRight >= 288) return { left: "0", right: "auto", transform: "none" };
                if (spaceLeft >= 288) return { right: "0", left: "auto", transform: "none" };
                return { left: "50%", transform: "translateX(-50%)" };
              })()),
            }}
          >
          <div className="border-b border-[#E4E7EC] px-4 py-3 text-sm font-bold text-[#101828]">Notifications</div>
          <div className={showAll ? "max-h-[32rem] overflow-y-auto" : ""}>
            {!loaded && <div className="px-4 py-6 text-center text-xs text-[#98A2B3]">লোড হচ্ছে…</div>}
            {loaded && items.length === 0 && <div className="px-4 py-6 text-center text-xs text-[#98A2B3]">কোনো notification নেই।</div>}
            {visibleItems.map((n) => (
              <button
                type="button"
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`block w-full border-b border-[#E4E7EC] px-4 py-3 text-left transition-colors last:border-none ${
                  n.is_read
                    ? "bg-[#F8FAFC] hover:bg-[#F1F5F9]"
                    : "bg-[#E8F1FF] hover:bg-[#DCEAFF]"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
                      n.is_read ? "bg-[#98A2B3]" : "bg-[#2563EB]"
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-xs ${n.is_read ? "font-medium text-[#475467]" : "font-bold text-[#101828]"}`}>
                      {n.message}
                    </span>
                    <span className="mt-1 block text-[10px] text-[#667085]">
                      {new Date(n.created_at).toLocaleString("bn-BD")}
                    </span>
                  </span>
                  <span className="text-sm text-[#667085]" aria-hidden="true">→</span>
                </div>
              </button>
            ))}
          </div>
          {loaded && hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAll((current) => !current)}
              className="w-full border-t border-[#E4E7EC] px-4 py-2.5 text-xs font-bold text-[#2554C7] hover:bg-[#F8FAFC]"
            >
              {showAll ? "কম দেখুন" : `আরও দেখুন (${hiddenCount})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
