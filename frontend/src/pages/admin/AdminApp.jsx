import { useState, useEffect, useCallback } from "react";
import { Routes, Route, Navigate, Link, NavLink, useLocation } from "react-router-dom";
import AdminLogin from "./AdminLogin.jsx";
import ProjectList from "./ProjectList.jsx";
import ProjectEditor from "./ProjectEditor.jsx";
import UsersPage from "./UsersPage.jsx";
import DashboardPage from "./DashboardPage.jsx";
import TasksPage from "./TasksPage.jsx";
import CustomersPage from "./GuestsPage.jsx";
import CustomerDetailPage from "./GuestDetailPage.jsx";
import SettingsPage from "./SettingsPage.jsx";
import SheetsPage from "./SheetsPage.jsx";
import ReportsPage from "./ReportsPage.jsx";
import AgentChatWidget from "../../components/AgentChatWidget.jsx";
import Breadcrumb from "../../components/Breadcrumb.jsx"; // path আপনার ফোল্ডার স্ট্রাকচার অনুযায়ী adjust করুন
import InstallAppButton from "../../components/InstallAppButton.jsx";
import NotificationBell from "../../components/NotificationBell.jsx";
import ProfileAvatar from "../../components/ProfileAvatar.jsx";
import useSessionTracking from "../../hooks/useSessionTracking.js";
import PerformancePage from "./PerformancePage.jsx";
import ExecutivePerformanceDetail from "./CommunicatorPerformanceDetail.jsx";
import MyPerformancePage from "./MyPerformancePage.jsx";
import FollowupsPage from "./FollowupsPage.jsx";
import { getMe, logout } from "../../api/guest.js";
import { useRealtimeRefresh } from "../../realtime/RealtimeContext.jsx";
import ErrorBoundary from "../../components/ErrorBoundary.jsx";


function readStoredUser() {
  try {
    return JSON.parse(sessionStorage.getItem("qf_current_user") || "null");
  } catch {
    return null;
  }
}

export default function AdminApp() {
  const [currentUser, setCurrentUser] = useState(readStoredUser());
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(() => localStorage.getItem("qf_sidebar_expanded") === "true");
  const location = useLocation();

  const authed = Boolean(sessionStorage.getItem("qf_admin_token")) && currentUser;
  const canSeeCustomers = ["admin", "executive", "user"].includes(currentUser?.role);
  const endPerformanceSession = useSessionTracking(
    Boolean(authed && currentUser?.role === "executive"),
  );

  const refreshCurrentUser = useCallback(async () => {
    if (!sessionStorage.getItem("qf_admin_token")) return;
    try {
      const response = await getMe();
      sessionStorage.setItem("qf_current_user", JSON.stringify(response.data));
      setCurrentUser(response.data);
    } catch (error) {
      if (error.response?.status === 401) {
        sessionStorage.removeItem("qf_current_user");
        setCurrentUser(null);
      }
    }
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const syncCurrentUser = () => setCurrentUser(readStoredUser());
    window.addEventListener("qf:current-user-updated", syncCurrentUser);
    window.addEventListener("qf:auth-changed", syncCurrentUser);
    return () => {
      window.removeEventListener("qf:current-user-updated", syncCurrentUser);
      window.removeEventListener("qf:auth-changed", syncCurrentUser);
    };
  }, []);

  useEffect(() => {
    refreshCurrentUser();
    const handleFocus = () => refreshCurrentUser();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refreshCurrentUser]);

  useRealtimeRefresh(["users"], refreshCurrentUser);

  async function handleLoggedOut() {
    endPerformanceSession();
    try {
      await logout();
    } catch {
      // A missing/expired token already means the local session must end.
    } finally {
      sessionStorage.removeItem("qf_admin_token");
      sessionStorage.removeItem("qf_current_user");
      sessionStorage.removeItem("qf_perf_session_id");
      window.dispatchEvent(new Event("qf:auth-changed"));
      setCurrentUser(null);
    }
  }

  if (!authed) {
    return <AdminLogin onSuccess={(user) => setCurrentUser(user)} />;
  }

  const isAdmin = currentUser.role === "admin";
  const isDataUser = currentUser.role === "user";
  const canAccessEvents = !isDataUser
    || Boolean(currentUser.can_create_events)
    || Boolean(currentUser.permissions?.length);

  return (
    <div className={`flex h-screen overflow-hidden bg-[#F8FAFC] flex-col md:flex-row ${sidebarExpanded ? "sidebar-expanded" : "sidebar-collapsed"}`}>
      {/* Mobile Top Header */}
      <header className="flex flex-shrink-0 items-center justify-between border-b border-[#E9EDF2] bg-white px-4 py-3 md:hidden">
        <Link to="/admin" className="flex items-center gap-2.5">
          <img src="/quantum-favicon.png" alt="Quantum Foundation" className="h-12 w-12 rounded-full object-contain" />
          <span className="whitespace-nowrap text-sm font-black tracking-tight text-[#101828]">Quantum Foundation</span>
        </Link>
        <div className="flex items-center gap-2">
          <NotificationBell placement="topbar" />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D0D5DD] text-sm text-[#344054] hover:border-[#84ADFF] hover:bg-[#EEF4FF]"
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </header>

      {/* Backdrop for Mobile */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
        />
      )}

      

      <Sidebar
        currentUser={currentUser}
        canSeeCustomers={canSeeCustomers}
        onLoggedOut={handleLoggedOut}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        sidebarExpanded={sidebarExpanded}
        setSidebarExpanded={setSidebarExpanded}
      />

      {!isDataUser && <AgentChatWidget currentUser={currentUser} />}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Breadcrumb currentUser={currentUser} onLoggedOut={handleLoggedOut} />
        <main className={`min-h-0 min-w-0 flex-1 overflow-y-auto p-3 transition-[padding] duration-200 ${sidebarExpanded ? "md:p-4 lg:px-5 lg:py-4" : "md:p-2"}`}>
          <ErrorBoundary>
            <Routes>
          
          <Route
            path="/"
            element={
              isAdmin ? (
                <DashboardPage onLoggedOut={handleLoggedOut} />
              ) : isDataUser ? (
                <Navigate to="/admin/tasks" replace />
              ) : (
                <ProjectList onLoggedOut={handleLoggedOut} currentUser={currentUser} />
              )
            }
          />
          {canAccessEvents && <Route path="/events" element={<ProjectList onLoggedOut={handleLoggedOut} currentUser={currentUser} />} />}
          {canAccessEvents && <Route path="/projects/:id" element={<ProjectEditor onLoggedOut={handleLoggedOut} currentUser={currentUser} />} />}
          <Route path="/tasks" element={<TasksPage onLoggedOut={handleLoggedOut} currentUser={currentUser} />} />
          {!isDataUser && <Route path="/followups" element={<FollowupsPage />} />}
          {!isDataUser && <Route path="/reports" element={<ReportsPage currentUser={currentUser} onLoggedOut={handleLoggedOut} />} />}
          {!isDataUser && <Route path="/sheets" element={<SheetsPage onLoggedOut={handleLoggedOut} />} />}
          {canSeeCustomers && (
            <>
              <Route path="/customers" element={<CustomersPage onLoggedOut={handleLoggedOut} currentUser={currentUser} />} />
              <Route path="/customers/:id" element={<CustomerDetailPage onLoggedOut={handleLoggedOut} currentUser={currentUser} />} />
            </>
          )}
          {isAdmin && (
            <Route path="/users" element={<UsersPage onLoggedOut={handleLoggedOut} currentUser={currentUser} />} />
          )}
          <Route path="/settings" element={<SettingsPage currentUser={currentUser} onLoggedOut={handleLoggedOut} />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
          {isAdmin && <Route path="/performance" element={<PerformancePage onLoggedOut={handleLoggedOut} />} />}
          {isAdmin && <Route path="/performance/:userId" element={<ExecutivePerformanceDetail onLoggedOut={handleLoggedOut} />} />}
          {!isAdmin && !isDataUser && <Route path="/my-performance" element={<MyPerformancePage onLoggedOut={handleLoggedOut} />} />}
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function Sidebar({ currentUser, canSeeCustomers, onLoggedOut, mobileOpen, setMobileOpen, sidebarExpanded, setSidebarExpanded }) {
  const sidebarLocation = useLocation();
  const isAdmin = currentUser.role === "admin";
  const isDataUser = currentUser.role === "user";
  const canAccessEvents = !isDataUser
    || Boolean(currentUser.can_create_events)
    || Boolean(currentUser.permissions?.length);

  const navItems = [
    ...(isAdmin ? [{ to: "/admin", label: "Overview", icon: "ti-layout-dashboard", exact: true }] : []),
    ...(isAdmin ? [{ to: "/admin/performance", label: "Performance", icon: "ti-chart-bar" }] : []),
    ...(!isAdmin && !isDataUser ? [{ to: "/admin/my-performance", label: "My Performance", icon: "ti-chart-bar" }] : []),

    ...(canAccessEvents ? [{ to: "/admin/events", label: "Events", icon: "ti-calendar-event" }] : []),
    ...(canSeeCustomers ? [{ to: "/admin/customers", label: "Guests", icon: "ti-users" }] : []),
    { to: "/admin/tasks", label: "Tasks", icon: "ti-checklist" },
    ...(!isDataUser ? [{ to: "/admin/followups", label: "Follow-ups", icon: "ti-phone-call" }] : []),
    ...(!isDataUser ? [{ to: "/admin/reports", label: "Reports", icon: "ti-file-analytics" }] : []),
    ...(isAdmin ? [{ to: "/admin/users", label: "Users & Access", icon: "ti-shield-lock" }] : []),
    ...(!isDataUser ? [{ to: "/admin/sheets", label: "Sheets", icon: "ti-table" }] : []),
    { to: "/admin/settings", label: "Settings", icon: "ti-settings" },
  ];

  function isSectionActive(item) {
    const path = sidebarLocation.pathname;
    if (item.exact) return path === item.to;
    if (item.to === "/admin/events") return path === item.to || path.startsWith("/admin/projects/");
    return path === item.to || path.startsWith(`${item.to}/`);
  }

  function toggleSidebar() {
    setSidebarExpanded((expanded) => {
      const next = !expanded;
      localStorage.setItem("qf_sidebar_expanded", String(next));
      return next;
    });
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[#E9EDF2] bg-white transition-[width,flex-basis,transform] duration-200 ease-in-out md:relative md:h-screen md:flex-none md:translate-x-0 ${sidebarExpanded ? "md:w-56 md:basis-56" : "md:w-16 md:basis-16"} ${
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}
    >
      {/* Logo */}
      <div className={`flex h-16 flex-shrink-0 items-center justify-between gap-2.5 border-b border-[#E9EDF2] px-4 ${!sidebarExpanded ? "md:justify-center md:px-2" : ""}`}>
        <Link to="/admin" className={`flex items-center gap-2.5 ${!sidebarExpanded ? "md:justify-center" : ""}`} title="Quantum Foundation">
          <img src="/quantum-favicon.png" alt="Quantum Foundation" className={`h-12 w-12 rounded-full object-contain ${!sidebarExpanded ? "md:h-10 md:w-10" : ""}`} />
          <span className={`whitespace-nowrap text-sm font-black tracking-tight text-[#101828] ${!sidebarExpanded ? "md:hidden" : ""}`}>Quantum Foundation</span>
        </Link>
        <button
          onClick={() => setMobileOpen(false)}
          className="rounded-lg p-1 text-xs text-[#667085] hover:bg-[#F9FAFB] md:hidden"
        >
          ✕
        </button>
      </div>

      {/* Desktop sidebar toggle — kept below the logo */}
      <div className={`hidden flex-shrink-0 border-b border-[#E9EDF2] p-2 md:flex ${sidebarExpanded ? "justify-stretch" : "justify-center"}`}>
        <button
          type="button"
          onClick={toggleSidebar}
          title={sidebarExpanded ? "Close sidebar" : "Open sidebar"}
          aria-label={sidebarExpanded ? "Close sidebar" : "Open sidebar"}
          className={`flex h-9 items-center rounded-lg text-xs font-semibold text-[#667085] transition-colors hover:bg-[#F9FAFB] hover:text-[#2554C7] ${sidebarExpanded ? "w-full gap-2 px-3" : "w-10 justify-center px-0"}`}
        >
          <i className={`ti ${sidebarExpanded ? "ti-layout-sidebar-left-collapse" : "ti-layout-sidebar-left-expand"}`} style={{ fontSize: 18 }} aria-hidden="true" />
          {sidebarExpanded && <span>Close sidebar</span>}
        </button>
      </div>

      {/* Nav */}
      <nav className={`flex-1 overflow-y-auto py-4 ${sidebarExpanded ? "px-3" : "px-3 md:px-2"}`}>
        {!isAdmin && (
          <div className={`mb-1 px-2 text-[10px] font-bold uppercase tracking-wider text-[#98A2B3] ${!sidebarExpanded ? "md:hidden" : ""}`}>
            আমার কাজ
          </div>
        )}
        <ul className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const sectionActive = isSectionActive(item);
            return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.exact}
                title={!sidebarExpanded ? item.label : undefined}
                className={({ isActive }) =>
                  `relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${!sidebarExpanded ? "md:justify-center md:px-2" : ""} ${
                    isActive || sectionActive
                      ? "bg-[#EEF4FF] text-[#2554C7]"
                      : "text-[#344054] hover:bg-[#F9FAFB] hover:text-[#101828]"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {(isActive || sectionActive) && (
                      <span className="absolute bottom-1.5 left-0 top-1.5 w-1 rounded-r-full bg-[#2554C7]" aria-hidden="true" />
                    )}
                    <i
                      className={`ti ${item.icon}`}
                      style={{ fontSize: 17, color: isActive || sectionActive ? "#2554C7" : "#667085" }}
                      aria-hidden="true"
                    />
                    <span className={!sidebarExpanded ? "md:hidden" : ""}>{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          )})}
        </ul>
      </nav>

      {/* Footer */}
      <div className={`mt-auto flex-shrink-0 border-t border-[#E9EDF2] p-3 ${!sidebarExpanded ? "md:px-2" : ""}`}>
        <InstallAppButton compact={!sidebarExpanded} />
        <div className="mt-2 hidden flex-col gap-2 rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] px-3 py-3 md:flex">
          <div className="flex items-center gap-2.5">
            <ProfileAvatar name={currentUser.name} imageUrl={currentUser.profile_image_url} className="h-9 w-9" fallbackClassName="bg-[#2554C7]" />
            <div className="min-w-0">
              <div className="truncate text-xs font-bold text-[#101828]">{currentUser.name}</div>
              <div className="text-[10px] uppercase tracking-wide text-[#98A2B3]">{currentUser.role === "admin" ? "admin" : currentUser.role === "user" ? "user" : "communicator"}</div>
            </div>
          </div>
        </div>
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] px-3 py-3 md:hidden">
          <div className="flex items-center gap-2.5">
            <ProfileAvatar name={currentUser.name} imageUrl={currentUser.profile_image_url} className="h-9 w-9" fallbackClassName="bg-[#2554C7]" />
            <div className="min-w-0">
              <div className="truncate text-xs font-bold text-[#101828]">{currentUser.name}</div>
              <div className="text-[10px] uppercase tracking-wide text-[#98A2B3]">{currentUser.role === "admin" ? "admin" : currentUser.role === "user" ? "user" : "communicator"}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onLoggedOut}
            className="w-full rounded-lg border border-[#FDA29B] bg-[#FEF3F2] px-3 py-2 text-xs font-bold text-[#D92D20] transition-colors hover:border-[#F04438] hover:bg-[#FEE4E2]"
          >
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
