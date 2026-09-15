import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listProjects, createProject, deleteProject, renameProject } from "../../api/guest.js";
import { API_BASE } from "../../api/guest.js";
import SortDropdown from "../../components/SortDropdown.jsx";
import { sortItems } from "../../utils/sort.js";
import { reloadPage } from "../../utils/reload.js";
import { useRealtimeRefresh } from "../../realtime/RealtimeContext.jsx";

const SORT_OPTIONS = [
  { value: "date:desc", label: "Newest first" },
  { value: "date:asc", label: "Oldest first" },
  { value: "name:asc", label: "Name A-Z" },
  { value: "status:desc", label: "Published first" },
];

const SORT_GETTERS = {
  date: (p) => new Date(p.created_at || 0).getTime(),
  name: (p) => (p.name || "").toLowerCase(),
  status: (p) => (p.published ? 1 : 0),
};

export default function ProjectList({ onLoggedOut, currentUser }) {
  const navigate = useNavigate();
  const isAdmin = currentUser?.role === "admin";
  const canCreateEvent = isAdmin || Boolean(currentUser?.can_create_events);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [sortKey, setSortKey] = useState("date:desc");

  function load() {
    setLoading(true);
    listProjects()
      .then((res) => setProjects(res.data))
      .catch((err) => {
        if (err.response?.status === 401) onLoggedOut();
        else setError("প্রজেক্ট লোড করা যায়নি।");
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);
  useRealtimeRefresh(["projects", "project_permissions"], load);

  useEffect(() => {
    window.addEventListener("qf:refresh-current-view", load);
    return () => window.removeEventListener("qf:refresh-current-view", load);
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const res = await createProject(newName.trim());
      setNewName("");
      setCreating(false);
      setProjects((p) => [res.data, ...p]);
      navigate(`/admin/projects/${res.data.id}`);
    } catch {
      setError("প্রজেক্ট তৈরি করা যায়নি।");
    }
  }

  async function handleDelete(id, name) {
    if (!confirm(`"${name}" — এই প্রজেক্ট এবং এর সব registration মুছে ফেলবেন? এই কাজ পূর্বাবস্থায় ফেরানো যাবে না।`)) return;
    await deleteProject(id);
    setProjects((p) => p.filter((x) => x.id !== id));
  }

  async function handleRenameConfirm(id) {
    if (!renameValue.trim()) return setRenamingId(null);
    const res = await renameProject(id, renameValue.trim());
    setProjects((p) => p.map((x) => (x.id === id ? res.data : x)));
    setRenamingId(null);
    reloadPage();
  }
  
  // Card/row এ onMouseEnter দিন
  function handleProjectHover(id) {
    // Implementation for handling project hover
  }

  const sortedProjects = sortItems(projects, sortKey, SORT_GETTERS);

  return (
    <div className="w-full max-w-none px-1 py-3 sm:px-2">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-black text-[#101828]">Events / Projects</h1>
          <p className="text-xs text-[#667085]">
            {isAdmin ? "Quantum Foundation-এর সব registration project এখান থেকে ম্যানেজ করুন।" : "আপনাকে যেসব ইভেন্টে অ্যাকসেস দেওয়া হয়েছে সেগুলো এখানে দেখা যাচ্ছে।"}
          </p>
        </div>
        <SortDropdown value={sortKey} onChange={setSortKey} options={SORT_OPTIONS} />
      </div>

      {canCreateEvent && (creating ? (
        <form onSubmit={handleCreate} className="mb-5 flex gap-2 rounded-xl border border-[#E4E7EC] bg-white p-3">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="নতুন ইভেন্টের নাম লিখুন"
            className="flex-1 rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm outline-none focus:border-[#2554C7]"
          />
          <button type="submit" className="rounded-lg bg-[#2554C7] px-4 py-2 text-xs font-bold text-white hover:bg-[#17368F]">
            Create
          </button>
          <button type="button" onClick={() => setCreating(false)} className="rounded-lg border border-[#D0D5DD] px-4 py-2 text-xs font-semibold text-[#344054]">
            Cancel
          </button>
        </form>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#D0D5DD] bg-white py-3.5 text-sm font-semibold text-[#2554C7] hover:border-[#2554C7] hover:bg-[#EEF4FF]"
        >
          + নতুন Event তৈরি করুন
        </button>
      ))}

      {error && <div className="mb-4 rounded-lg bg-[#FEF3F2] px-3 py-2 text-xs text-[#D92D20]">{error}</div>}
      {loading && <div className="py-10 text-center text-sm text-[#667085]">লোড হচ্ছে…</div>}

      {!loading && sortedProjects.length === 0 && (
        <div className="rounded-xl border border-[#E4E7EC] bg-white py-14 text-center text-sm text-[#98A2B3]">
          {isAdmin ? "এখনো কোনো Event তৈরি হয়নি।" : "আপনাকে এখনো কোনো ইভেন্টে অ্যাকসেস দেওয়া হয়নি — অ্যাডমিনের সাথে যোগাযোগ করুন।"}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {sortedProjects.map((p) => (
          <div key={p.id} className="flex items-center gap-2.5 rounded-xl border border-[#E4E7EC] bg-white px-3 py-2">
            <div className="flex-1 min-w-0">
              {renamingId === p.id ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="flex-1 rounded-lg border border-[#E4E7EC] px-2.5 py-1.5 text-sm outline-none focus:border-[#2554C7]"
                  />
                  <button onClick={() => handleRenameConfirm(p.id)} className="rounded-lg bg-[#2554C7] px-3 py-1.5 text-xs font-bold text-white">
                    Save
                  </button>
                  <button onClick={() => setRenamingId(null)} className="rounded-lg border border-[#D0D5DD] px-3 py-1.5 text-xs font-semibold text-[#344054]">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-[#101828]">{p.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${p.published ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[#F1F2F4] text-[#667085]"}`}>
                    {p.published ? "Published" : "Draft"}
                  </span>
                </div>
              )}
              <div className="mt-0.5 truncate text-[10px] leading-tight text-[#98A2B3]">
                <a href={`${window.location.origin}/?${encodeURIComponent(p.id)}`} className="hover:text-[#2554C7] hover:underline">
                  {`${window.location.origin}/?${p.id}`}
                </a>
              </div>
            </div>
            <div className="flex flex-shrink-0 items-center gap-1.5">
              {isAdmin && (
                <>
                  <button
                    onClick={() => {
                      setRenamingId(p.id);
                      setRenameValue(p.name);
                    }}
                    title="Rename"
                    className="rounded-lg border border-[#E4E7EC] p-1.5 text-[#667085] hover:border-[#2554C7] hover:text-[#2554C7]"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => handleDelete(p.id, p.name)}
                    title="Delete"
                    className="rounded-lg border border-[#E4E7EC] p-1.5 text-[#667085] hover:border-[#D92D20] hover:text-[#D92D20]"
                  >
                    🗑
                  </button>
                </>
              )}
              <button
                onClick={() => navigate(`/admin/projects/${p.id}`)}
                className="rounded-lg bg-[#2554C7] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#17368F]"
              >
                Open →
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-[11px] text-[#98A2B3]">API: {API_BASE}</p>
    </div>
  );
}
