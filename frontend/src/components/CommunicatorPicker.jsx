import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function CommunicatorPicker({
  executives,
  workload,
  onSelect,
  label,
  buttonClassName = "",
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, maxHeight: 320 });

  useEffect(() => {
    if (!open) return undefined;

    const positionMenu = () => {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingGuestRect();
      const menuWidth = 256;
      const gap = 8;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const spaceAbove = rect.top - gap;
      const openAbove = spaceBelow < 180 && spaceAbove > spaceBelow;
      const desiredHeight = Math.min(320, 16 + Math.max(1, executives?.length || 0) * 48);
      const maxHeight = Math.max(80, Math.min(desiredHeight, (openAbove ? spaceAbove : spaceBelow) - 8));
      setMenuPosition({
        top: openAbove ? Math.max(8, rect.top - maxHeight - gap) : rect.bottom + gap,
        left: Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8)),
        maxHeight,
      });
    };
    const closeOutside = (event) => {
      if (!buttonRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };

    positionMenu();
    document.addEventListener("mousedown", closeOutside);
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [open, executives?.length]);

  const handleSelect = (executiveId) => {
    onSelect(executiveId);
    setOpen(false);
  };

  return (
    <div className={`relative max-w-full ${buttonClassName.includes("w-full") ? "block w-full" : "inline-block"}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        className={`max-w-full whitespace-normal rounded-full bg-[#2554C7] px-3 py-2 text-xs font-bold leading-tight text-white hover:bg-[#17368F] ${buttonClassName}`}
      >
        {label}
      </button>

      {open && createPortal(
        <div ref={menuRef} className="fixed z-[100] w-64 rounded-lg border border-[#E4E7EC] bg-white shadow-xl" style={{ top: menuPosition.top, left: menuPosition.left }}>
          <div className="overflow-y-auto p-2" style={{ maxHeight: menuPosition.maxHeight }}>
            {executives && executives.length > 0 ? (
              executives.map((exec) => {
                const stats = Array.isArray(workload)
                  ? workload.find((item) => item.user_id === exec.id) || {}
                  : workload?.[exec.id] || {};
                const pending = Number(stats.pending || 0);
                const pendingFollowups = Number(stats.pending_followups || 0);
                return (
                  <button
                    key={exec.id}
                    type="button"
                    onClick={() => handleSelect(exec.id)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-[#F0F4F8]"
                  >
                    <span className="font-medium text-[#101828]">
                      {exec.name}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-full bg-[#FEF0C7] px-2 py-0.5 text-[10px] font-bold text-[#DC6803]" title="Pending tasks">
                        Task {pending}
                      </span>
                      <span className="rounded-full bg-[#EEF4FF] px-2 py-0.5 text-[10px] font-bold text-[#2554C7]" title="Pending follow-ups">
                        Follow-up {pendingFollowups}
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-2 text-xs text-[#667085]">
                No communicators available
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
