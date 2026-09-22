import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getProject, togglePublish } from "../../api/guest.js";
import EventTab from "./tabs/EventTab.jsx";
import FieldsTab from "./tabs/FieldsTab.jsx";
import RegistrationsTab from "./tabs/RegistrationsTab.jsx";
import SettingsTab from "./tabs/SettingsTab.jsx";
import { consumeReloadState } from "../../utils/reload.js";
import { useRealtimeRefresh } from "../../realtime/realtimeHooks.js";

const TABS = [
  { id: "event", label: "Event" },
  { id: "fields", label: "Form Fields" },
  { id: "registrations", label: "Registrations" },
  { id: "settings", label: "Settings" },
];

export default function ProjectEditor({ onLoggedOut }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [project, setProject] = useState(null);
  const [tab, setTab] = useState(() => searchParams.get("tab") || consumeReloadState()?.projectEditorTab || "event");
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [urlCopied, setUrlCopied] = useState(false);

  const reload = useCallback(() => {
    getProject(id)
      .then((res) => setProject(res.data))
      .catch((err) => {
        if (err.response?.status === 401) onLoggedOut();
        else if (err.response?.status === 404) navigate("/admin");
      });
  }, [id, navigate, onLoggedOut]);

  useEffect(reload, [reload]);
  useRealtimeRefresh(["projects"], reload);

  useEffect(() => {
    window.addEventListener("qf:refresh-current-view", reload);
    return () => window.removeEventListener("qf:refresh-current-view", reload);
  }, [reload]);

  useEffect(() => {
    const nextTab = searchParams.get("tab") || "event";
    setTab((current) => current === nextTab ? current : nextTab);
  }, [searchParams]);

  useEffect(() => {
    if (!project) return;
    window.dispatchEvent(new CustomEvent("qf:breadcrumb-context", {
      detail: { projectId: project.id, projectName: project.name, section: tab },
    }));
  }, [project, tab]);

  function selectTab(nextTab) {
    setTab(nextTab);
    setSearchParams(nextTab === "event" ? {} : { tab: nextTab });
  }

  async function handleTogglePublish() {
    setPublishBusy(true);
    setPublishError("");
    try {
      const res = await togglePublish(id);
      setProject(res.data);
    } catch (err) {
      setPublishError(err.response?.data?.detail || "Publish করা যায়নি।");
    } finally {
      setPublishBusy(false);
    }
  }

  async function handleCopyUrl() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setUrlCopied(true);
    } catch {
      return;
    }
  }

  useEffect(() => {
    if (!urlCopied) return undefined;
    const timer = window.setTimeout(() => setUrlCopied(false), 3000);
    return () => window.clearTimeout(timer);
  }, [urlCopied]);

  if (!project) {
    return <div className="px-6 py-14 text-center text-sm text-[#667085]">লোড হচ্ছে…</div>;
  }
 
  const shareUrl = `${window.location.origin}/?${encodeURIComponent(project.id)}`;
  const regUrl = `${window.location.origin}/register?${encodeURIComponent(project.id)}`;

  return (
    <div className="w-full max-w-none px-1 py-3 sm:px-2"> 
      <button onClick={() => navigate("/admin/events")} className="back-button mb-4">
        ← সব প্রজেক্ট
      </button>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E4E7EC] bg-white p-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-black text-[#101828]">{project.name}</h1>
          <div className="mt-2 flex max-w-xl items-center overflow-hidden rounded-lg border border-[#D0D5DD] bg-[#F9FAFB] p-1">
            <a
              href={shareUrl}
              target="_blank"
              rel="noreferrer"
              title={shareUrl}
              className="min-w-0 flex-1 truncate px-2 text-[11px] text-[#667085] hover:text-[#2554C7] hover:underline"
            >
              {shareUrl}
            </a>
            <button
              type="button"
              onClick={handleCopyUrl}
              className={`w-[68px] flex-none rounded-md px-2 py-1.5 text-[10px] font-bold transition ${
                urlCopied
                  ? "bg-[#ECFDF3] text-[#027A48]"
                  : "bg-white text-[#344054] shadow-sm ring-1 ring-inset ring-[#D0D5DD] hover:text-[#2554C7]"
              }`}
            >
              {urlCopied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${project.published ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[#F1F2F4] text-[#667085]"}`}>
            {project.published ? "Published" : "Draft"}
          </span>
          <button
            onClick={handleTogglePublish}
            disabled={publishBusy}
            className={`rounded-full px-4 py-2 text-xs font-bold text-white disabled:opacity-60 ${
              project.published ? "bg-[#667085] hover:opacity-90" : "bg-[#027A48] hover:opacity-90"
            }`}
          >
            {project.published ? "Unpublish" : "Publish"}
          </button>
        </div>
      </div>

      {publishError && <div className="mb-4 rounded-lg bg-[#FEF3F2] px-3 py-2 text-xs text-[#D92D20]">{publishError}</div>}

      <div className="mb-5 flex gap-1 rounded-xl bg-[#F1F2F4] p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => selectTab(t.id)}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
              tab === t.id ? "bg-white text-[#17368F] shadow-sm" : "text-[#667085] hover:text-[#344054]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "event" && <EventTab project={project} onSaved={setProject} />}
      {tab === "fields" && <FieldsTab projectId={project.id} />}
      {tab === "registrations" && <RegistrationsTab projectId={project.id} regUrl={regUrl} />}
      {tab === "settings" && <SettingsTab project={project} onSaved={setProject} />}
    </div>
  );
}
