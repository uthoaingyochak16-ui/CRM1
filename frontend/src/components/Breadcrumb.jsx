import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { HomeIcon } from "./Icons.jsx";
import NotificationBell from "./NotificationBell.jsx";
import ProfileAvatar from "./ProfileAvatar.jsx";

// Map of known path segments -> display label.
// Add a new entry here whenever you add a new top-level admin route.
const SEGMENT_LABELS = {
  admin: "Overview",
  events: "Events",
  projects: "Events",
  tasks: "Tasks",
  reports: "Reports",
  sheets: "Sheets",
  customers: "Guests",
  users: "Users & Access",
  settings: "Settings",
  todo: "আজকের To-do",
  performance: "Performance",
  "my-performance": "My Performance",
  followups: "Follow-ups",
};

// Segments that are dynamic ids (uuid/number) and shouldn't be shown as raw text.
function isDynamicSegment(seg) {
  return /^[0-9a-fA-F-]{8,}$/.test(seg) || /^\d+$/.test(seg);
}

/**
 * Breadcrumb / page-path bar.
 * Place ONCE in the shared admin layout (e.g. AdminApp.jsx), above <Routes>,
 * so it renders on every page and updates itself on navigation.
 *
 * Optional: pass `dynamicLabel` when a page wants its :id segment to show
 * a real name instead of "Details" (e.g. CustomerDetailPage can render
 * <Breadcrumb dynamicLabel={customer?.full_name} /> — but this component
 * also works with zero props out of the box.
 */
export default function Breadcrumb({ dynamicLabel, currentUser, onLoggedOut }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const parts = location.pathname.split("/").filter(Boolean); // e.g. ["admin","customers","abc123"]

  // "admin" itself is the Home/root crumb — don't duplicate it as a separate segment.
  const rest = parts[0] === "admin" ? parts.slice(1) : parts;
  const isHomeOnly = rest.length === 0;

  const crumbs = [];
  let pathAcc = "/admin";
  rest.forEach((seg, i) => {
    pathAcc += `/${seg}`;
    const isLast = i === rest.length - 1;
    if (isDynamicSegment(seg)) {
      crumbs.push({ label: dynamicLabel || "Details", href: pathAcc, isLast });
      return;
    }
    crumbs.push({ label: SEGMENT_LABELS[seg] || seg, href: pathAcc, isLast });
  });

  useEffect(() => {
    function closeProfile(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", closeProfile);
    return () => document.removeEventListener("mousedown", closeProfile);
  }, []);

  const roleLabel = currentUser?.role === "admin"
    ? "Admin"
    : currentUser?.role === "user" ? "User" : "Communicator";

  return (
    <div className="hidden h-16 flex-none items-center gap-2 border-b border-[#E9EDF2] bg-white px-2.5 text-[#101828] shadow-sm md:flex md:gap-3 md:px-4">
      <div className="flex flex-none items-center gap-1">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#2554C7] transition-colors hover:bg-[#EEF4FF] hover:text-[#173B7A]"
          aria-label="Go back"
          title="Back"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]" aria-hidden="true">
            <path d="M15 10H5.5M9 6.5 5.5 10 9 13.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => navigate(1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#667085] transition-colors hover:bg-[#EEF4FF] hover:text-[#2554C7]"
          aria-label="Go forward"
          title="Forward"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]" aria-hidden="true">
            <path d="M5 10h9.5M11 6.5l3.5 3.5-3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <nav
        aria-label="Page directory"
        className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap rounded-xl border border-[#B8C8EC] bg-[#F5F8FF] px-2 py-2 text-sm shadow-inner max-w-2xl mx-auto"
      >
        {isHomeOnly ? (
          <span className="flex items-center gap-1.5 font-bold text-[#173B7A]">
            <HomeIcon className="h-4 w-4" />
            Home
          </span>
        ) : (
          <Link to="/admin" className="flex items-center gap-1.5 font-semibold text-[#2554C7] hover:text-[#173B7A]">
            <HomeIcon className="h-4 w-4" />
            Home
          </Link>
        )}
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="text-[#98A2B3]">/</span>
            {c.isLast ? (
              <span className="font-bold text-[#101828]">{c.label}</span>
            ) : (
              <Link to={c.href} className="font-semibold text-[#667085] hover:text-[#2554C7]">
                {c.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <div className="flex flex-none items-center gap-1.5">
        <NotificationBell placement="topbar" />
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((open) => !open)}
            className="flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-[#D0D5DD] transition-shadow hover:ring-2 hover:ring-[#84ADFF]"
            aria-label="Open profile details"
            aria-expanded={profileOpen}
          >
            <ProfileAvatar name={currentUser?.name} imageUrl={currentUser?.profile_image_url} className="h-8 w-8" fallbackClassName="bg-[#2554C7]" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-[calc(100%+10px)] z-[60] w-72 overflow-hidden rounded-xl border border-[#E4E7EC] bg-white text-[#344054] shadow-xl">
              <div className="flex flex-col items-center border-b border-[#E4E7EC] bg-[#F5F8FF] px-5 py-4 text-center">
                <ProfileAvatar name={currentUser?.name} imageUrl={currentUser?.profile_image_url} className="h-16 w-16 ring-4 ring-white shadow-md" fallbackClassName="bg-[#2554C7] !text-xl" />
                <div className="mt-3 flex w-full flex-col items-center gap-2">
                  <div className="max-w-full truncate text-sm font-extrabold text-[#101828]">{currentUser?.name || "Profile"}</div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#E0EAFF] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#2554C7]">{roleLabel}</span>
                    <button
                      type="button"
                      onClick={() => {
                        onLoggedOut?.();
                        setProfileOpen(false);
                      }}
                      className="rounded-full border border-[#D0D5DD] bg-white px-3 py-1 text-[10px] font-semibold text-[#344054] transition hover:bg-[#F9FAFF]"
                    >
                      <i className="ti ti-logout" style={{ fontSize: 12 }} aria-hidden="true" />
                      <span className="ml-1">Logout</span>
                    </button>
                  </div>
                </div>
              </div>
              <div className="space-y-2.5 px-4 py-3 text-xs">
                {currentUser?.email && <ProfileRow icon="ti-mail" label="Email" value={currentUser.email} />}
                {currentUser?.phone && <ProfileRow icon="ti-phone" label="Phone" value={currentUser.phone} />}
                {currentUser?.designation && <ProfileRow icon="ti-briefcase" label="Designation" value={currentUser.designation} />}
              </div>
              <Link
                to="/admin/settings"
                onClick={() => setProfileOpen(false)}
                className="flex items-center justify-center gap-1.5 border-t border-[#E4E7EC] px-4 py-2.5 text-xs font-bold text-[#2554C7] hover:bg-[#F5F8FF]"
              >
                <i className="ti ti-settings" aria-hidden="true" /> Profile settings
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5">
      <i className={`ti ${icon} mt-0.5 text-[#667085]`} aria-hidden="true" />
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-[#98A2B3]">{label}</div>
        <div className="break-words font-semibold text-[#344054]">{value}</div>
      </div>
    </div>
  );
}
