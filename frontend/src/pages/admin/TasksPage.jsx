// frontend/src/pages/admin/TasksPage.jsx
import { Fragment, useEffect, useState, useCallback } from "react";
import { listTasks, getTaskHistory, createManualLead, updateTask, updateUser, bulkDeleteTasks, bulkAssignTasks, listUsers, getExecutiveWorkload, createCallLog, getCallConfig, listCallLogsByTask } from "../../api/guest";
import { useAutosave } from "../../hooks/useAutosave.js";
import ExecutivePicker from "../../components/CommunicatorPicker.jsx";
import LimitReachedModal from "../../components/LimitReachedModal.jsx";
import SortDropdown from "../../components/SortDropdown.jsx";
import { sortItems } from "../../utils/sort.js";
import { useRealtimeRefresh } from "../../realtime/RealtimeContext.jsx";
import { arrangeDataEntries } from "../../utils/dataArrangement.js";
import ProfileAvatar from "../../components/ProfileAvatar.jsx";
import ListScrollArea from "../../components/ListScrollArea.jsx";
import PeriodRangeFilter from "../../components/PeriodRangeFilter.jsx";
import {
  SearchIcon, PhoneCallIcon, CheckCircleIcon, XCircleIcon, MinusCircleIcon,
  ChevronDownIcon, ChevronUpIcon, TrashIcon, LoaderIcon,
} from "../../components/Icons.jsx";

const emptyForm = {
  assigned_to: "",
  data: { full_name: "", email: "", mobile: "", age: "", profession: "", location: "", remarks: "" },
};
const PROFESSION_OPTIONS = ["Student", "Teacher", "Doctor", "Engineer", "Lawyer", "Officer", "Police", "Banker", "Scientist", "Accountant", "Artist", "Journalist", "Businessman", "Housewife", "Retiree", "Other"];
const STAGE_OPTIONS = ["Interested","Dropped","Counselling","Associate","Course Acc","Potential Batch","QG","Quantier","QPM","Ardentiar","Organier","Foreigner"];
const STAGE_HEX = {
  Interested: "#0369a1", Dropped: "#be123c", Counselling: "#b45309", Associate: "#6d28d9",
  "Course Acc": "#4338ca", "Potential Batch": "#0f766e", QG: "#047857", Quantier: "#15803d",
  QPM: "#a21caf", Ardentiar: "#c2410c", Organier: "#0e7490", Foreigner: "#4d7c0f",
};
const SORT_OPTIONS = [
  { value: "date:desc", label: "Newest first" },
  { value: "date:asc", label: "Oldest first" },
  { value: "customer:asc", label: "Guest A-Z" },
  { value: "program:asc", label: "Program A-Z" },
];
const SORT_GETTERS = {
  date: (t) => new Date(t.created_at).getTime(),
  customer: (t) => (t.customer_name || "").toLowerCase(),
  program: (t) => (t.project_name || "").toLowerCase(),
};

const STAGE_COLORS = {
  Interested: "bg-sky-50 text-sky-700 ring-sky-200",
  Dropped: "bg-rose-50 text-rose-700 ring-rose-200",
  Counselling: "bg-amber-50 text-amber-700 ring-amber-200",
  Associate: "bg-violet-50 text-violet-700 ring-violet-200",
  "Course Acc": "bg-indigo-50 text-indigo-700 ring-indigo-200",
  "Potential Batch": "bg-teal-50 text-teal-700 ring-teal-200",
  QG: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Quantier: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  QPM: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200",
  Ardentiar: "bg-orange-50 text-orange-700 ring-orange-200",
  Organier: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  Foreigner: "bg-lime-50 text-lime-700 ring-lime-200",
};
const STAGE_ROW_COLORS = {
  Interested: "border-l-4 border-l-sky-600 bg-sky-200/80 hover:bg-sky-300/80",
  Dropped: "border-l-4 border-l-rose-600 bg-rose-200/80 hover:bg-rose-300/80",
  Counselling: "border-l-4 border-l-amber-600 bg-amber-200/80 hover:bg-amber-300/80",
  Associate: "border-l-4 border-l-violet-600 bg-violet-200/80 hover:bg-violet-300/80",
  "Course Acc": "border-l-4 border-l-indigo-600 bg-indigo-200/80 hover:bg-indigo-300/80",
  "Potential Batch": "border-l-4 border-l-teal-600 bg-teal-200/80 hover:bg-teal-300/80",
  QG: "border-l-4 border-l-emerald-600 bg-emerald-200/80 hover:bg-emerald-300/80",
  Quantier: "border-l-4 border-l-green-600 bg-green-200/80 hover:bg-green-300/80",
  QPM: "border-l-4 border-l-fuchsia-600 bg-fuchsia-200/80 hover:bg-fuchsia-300/80",
  Ardentiar: "border-l-4 border-l-orange-600 bg-orange-200/80 hover:bg-orange-300/80",
  Organier: "border-l-4 border-l-cyan-600 bg-cyan-200/80 hover:bg-cyan-300/80",
  Foreigner: "border-l-4 border-l-lime-600 bg-lime-200/80 hover:bg-lime-300/80",
};
// Border-left-only variant of STAGE_ROW_COLORS, used for the mobile card accent strip
// (mobile cards already carry their own background/hover treatment).
const STAGE_BORDER_COLORS = {
  Interested: "border-l-sky-600",
  Dropped: "border-l-rose-600",
  Counselling: "border-l-amber-600",
  Associate: "border-l-violet-600",
  "Course Acc": "border-l-indigo-600",
  "Potential Batch": "border-l-teal-600",
  QG: "border-l-emerald-600",
  Quantier: "border-l-green-600",
  QPM: "border-l-fuchsia-600",
  Ardentiar: "border-l-orange-600",
  Organier: "border-l-cyan-600",
  Foreigner: "border-l-lime-600",
};

function toDateInput(iso) { return iso ? iso.slice(0, 10) : ""; }
function todayDateInput() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
function isPendingNewLead(task) {
  const isAssigned = Boolean(task.assigned_to && String(task.assigned_to).trim());
  const isLead = Boolean(task.customer_id || task.registration_id);
  return isAssigned && isLead && !task.followup_id && task.status === "pending";
}
function isTodayFollowup(task) {
  return Boolean(task.followup_id)
    && task.status === "pending"
    && toDateInput(task.due_date) === todayDateInput();
}
function matchesSearch(t, q) {
  if (!q) return true;
  const hay = `${t.customer_name || ""} ${t.title || ""} ${t.project_name || ""} ${t.assignee_name || ""} ${t.creator_name || ""}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}
function normalizeDataKey(key) {
  return String(key || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}
function taskDataValue(task, ...aliases) {
  const data = task.registration_data || {};
  const labels = data.manual_field_labels || {};
  const entries = Object.entries(data)
    .filter(([key, value]) => key !== "manual_field_labels" && value !== "" && value != null);
  const values = new Map(
    entries.flatMap(([key, value]) => [
      [normalizeDataKey(key), value],
      ...(labels[key] ? [[normalizeDataKey(labels[key]), value]] : []),
    ]),
  );
  for (const alias of aliases) {
    const normalizedAlias = normalizeDataKey(alias);
    const value = values.get(normalizedAlias)
      ?? [...values.entries()].find(([key]) => key.includes(normalizedAlias))?.[1];
    if (value !== "" && value != null) return value;
  }
  return "";
}
function truncateWords(value, maxWords = 4) {
  const text = String(value || "").trim();
  if (!text) return "—";
  const words = text.split(/\s+/);
  return words.length > maxWords ? `${words.slice(0, maxWords).join(" ")}...` : text;
}

function ageFromDateOfBirth(value) {
  if (!value) return "";
  const text = String(value).trim();
  const match = text.match(/^(\d{1,2})[\/](\d{1,2})[\/](\d{4})$/);
  let birthDate;
  if (match) {
    birthDate = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  } else {
    birthDate = new Date(text);
    if (Number.isNaN(birthDate.getTime())) return "";
  }
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const birthdayPending = today.getMonth() < birthDate.getMonth()
    || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
  if (birthdayPending) age -= 1;
  return age >= 0 && age <= 130 ? age : "";
}

function taskSummary(task) {
  const suppliedAge = task.age ?? taskDataValue(task, "age", "guest_age", "বয়স", "বয়স");
  const dateOfBirth = taskDataValue(task, "date_of_birth", "dob", "birth_date", "জন্ম তারিখ");
  return {
    mobile: taskDataValue(task, "mobile", "phone", "phone_number"),
    age: suppliedAge !== "" && suppliedAge != null ? suppliedAge : ageFromDateOfBirth(dateOfBirth),
    profession: task.profession || taskDataValue(task, "profession", "occupation", "পেশা"),
    remarks: task.executive_remarks || taskDataValue(task, "executive_remarks", "consultant_remarks", "remarks", "মন্তব্য"),
    problem: task.customer_problem || taskDataValue(task, "customer_problem", "problem", "remarks_problem", "সমস্যা"),
  };
}

export default function TasksPage({ currentUser, onLoggedOut }) {
  const isAdmin = currentUser?.role === "admin";
  const canManualLeadEntry = isAdmin || currentUser?.role === "user" || Boolean(currentUser?.can_manual_lead_entry);
  const [tasks, setTasks] = useState([]);
  const [executives, setExecutives] = useState([]);
  const [workload, setWorkload] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [customFields, setCustomFields] = useState([]);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [tab, setTab] = useState(isAdmin ? "unassigned" : currentUser?.role === "user" ? "all" : "pending");
  const [openFormFor, setOpenFormFor] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [sortKey, setSortKey] = useState("date:desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [entryDateRange, setEntryDateRange] = useState({ dateFrom: "", dateTo: "" });
  const [entryUser, setEntryUser] = useState("");
  const [showLimits, setShowLimits] = useState(false);
  const [limitNotice, setLimitNotice] = useState("");
  const [taskDetail, setTaskDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  function load() {
    setLoading(true);
    const calls = [listTasks()];
    if (isAdmin) calls.push(listUsers(), getExecutiveWorkload());
    Promise.all(calls)
      .then(([taskRes, userRes, workloadRes]) => {
        setTasks(taskRes.data);
        if (isAdmin) {
          setExecutives(userRes.data.filter((u) => u.role === "executive" && u.is_active));
          setWorkload(workloadRes.data);
        }
      })
      .catch((err) => { if (err.response?.status === 401) onLoggedOut(); else setError("লোড করা যায়নি।"); })
      .finally(() => setLoading(false));
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps
  useRealtimeRefresh(["tasks", "customers", "registrations", "users", "projects"], load);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.data.full_name.trim()) return setError('"Name" ফিল্ডটি আবশ্যক।');
    if (!form.data.mobile.trim()) return setError('"Phone Number" ফিল্ডটি আবশ্যক।');
    setLeadSubmitting(true);
    setError("");
    try {
      const extraData = {};
      const manualFieldLabels = {};
      customFields.forEach((field, index) => {
        const label = field.label.trim();
        if (!label) return;
        const baseKey = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `custom_field_${index + 1}`;
        let key = baseKey;
        let suffix = 2;
        while (key in extraData || key in form.data) key = `${baseKey}_${suffix++}`;
        extraData[key] = field.value;
        manualFieldLabels[key] = label;
      });
      const res = await createManualLead({
        data: { ...form.data, ...extraData, manual_field_labels: manualFieldLabels },
        assigned_to: null,
      });
      setTasks((tasks) => [res.data, ...tasks]);
      setForm(emptyForm);
      setCustomFields([]);
      setCreating(false);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Manual lead তৈরি করা যায়নি।");
    } finally {
      setLeadSubmitting(false);
    }
  }

  async function toggleStatus(task) {
    const res = await updateTask(task.id, { status: task.status === "completed" ? "pending" : "completed" });
    setTasks((list) => list.map((t) => (t.id === task.id ? res.data : t)));
  }

  async function handleAssign(task, execId) {
    try {
      const res = await updateTask(task.id, { assigned_to: execId });
      setTasks((list) => list.map((t) => (t.id === task.id ? res.data : t)));
      const w = await getExecutiveWorkload(); setWorkload(w.data);
    } catch (requestError) {
      const detail = requestError.response?.data?.detail || "Task assign করা যায়নি।";
      if (/limit|পূর্ণ হয়েছে/i.test(detail)) setLimitNotice(detail);
      else setError(detail);
    }
  }

  async function handleBulkAssign(execId) {
    const ids = [...selected];
    try {
      const res = await bulkAssignTasks(ids, execId);
      const map = new Map(res.data.map((t) => [t.id, t]));
      setTasks((list) => list.map((t) => map.get(t.id) || t));
      setSelected(new Set());
      const w = await getExecutiveWorkload(); setWorkload(w.data);
    } catch (requestError) {
      const detail = requestError.response?.data?.detail || "Task assign করা যায়নি।";
      if (/limit|পূর্ণ হয়েছে/i.test(detail)) setLimitNotice(detail);
      else setError(detail);
    }
  }

  async function handleBulkDelete() {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkDeleting(true);
    setError("");
    try {
      await bulkDeleteTasks(ids);
      const deletedIds = new Set(ids);
      setTasks((list) => list.filter((task) => !deletedIds.has(task.id)));
      setSelected(new Set());
      setShowDeleteConfirm(false);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Selected tasks delete করা যায়নি।");
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleFollowUpSubmit(task, data) {
    const res = await updateTask(task.id, { ...data, status: "completed" });
    setTasks((list) => list.map((t) => (t.id === task.id ? res.data : t)));
    setOpenFormFor(null);
  }

  async function openReadOnlyDetails(task) {
    setDetailLoading(true);
    setError("");
    try {
      const response = await getTaskHistory(task.id);
      setTaskDetail({ task, ...response.data });
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Task details load করা যায়নি।");
    } finally {
      setDetailLoading(false);
    }
  }

  function toggleSelect(id) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleSelectAll(ids) {
    setSelected((s) => (s.size === ids.length ? new Set() : new Set(ids)));
  }
  function toggleTaskForm(taskId) {
    setOpenFormFor((currentId) => (currentId === taskId ? null : taskId));
  }

  const filtered = tasks
    .filter((t) => {
      const isAssigned = Boolean(t.assigned_to && String(t.assigned_to).trim());
      if (tab === "unassigned") return !isAssigned && t.status !== "completed";
      if (tab === "pending") return isPendingNewLead(t);
      if (tab === "completed") return t.status === "completed";
      if (tab === "followups") return isTodayFollowup(t);
      if (tab === "data_entries") return Boolean(t.manual_lead_data || t.title?.startsWith("Manual lead —"));
      return true;
    })
    .filter((t) => !entryDateRange.dateFrom || toDateInput(t.created_at) >= entryDateRange.dateFrom)
    .filter((t) => !entryDateRange.dateTo || toDateInput(t.created_at) <= entryDateRange.dateTo)
    .filter((t) => !entryUser || t.created_by === entryUser)
    .filter((t) => matchesSearch(t, searchQuery));
  const visible = sortItems(filtered, sortKey, SORT_GETTERS);
  const allIds = visible.map((t) => t.id);
  const allSelected = selected.size === allIds.length && allIds.length > 0;
  const showLeadSummary = tab === "unassigned";
  const isDataEntriesTab = isAdmin && tab === "data_entries";
  const taskColumnWidths = showLeadSummary
    ? { customer: "w-[18%]", program: "w-[10%]", stage: "w-[8%]", assignee: "w-[11%]", created: "w-[14%]", actions: "w-[10%]" }
    : isDataEntriesTab
      ? { customer: "w-[22%]", program: "w-[11%]", stage: "w-[8%]", assignee: "w-[12%]", created: "w-[23%]", actions: "w-[12%]" }
      : isAdmin
        ? { customer: "w-[28%]", program: "w-[14%]", stage: "w-[9%]", assignee: "w-[14%]", created: "w-[23%]", actions: "w-[12%]" }
        : { customer: "w-[38%]", program: "w-[18%]", stage: "w-[14%]", assignee: "", created: "w-[18%]", actions: "w-[12%]" };

  const tabCounts = tasks.reduce(
    (counts, task) => {
      const isAssigned = Boolean(task.assigned_to && String(task.assigned_to).trim());
      counts.all += 1;
      if (!isAssigned && task.status !== "completed") counts.unassigned += 1;
      if (isPendingNewLead(task)) counts.pending += 1;
      if (task.status === "completed") counts.completed += 1;
      if (isTodayFollowup(task)) counts.followups += 1;
      return counts;
    },
    { unassigned: 0, pending: 0, completed: 0, followups: 0, data_entries: tasks.filter((t) => t.title?.startsWith("Manual lead —")).length, all: 0 },
  );

  // New Leads first, All last (per requested ordering)
  const tabOptions = isAdmin
    ? [["unassigned","New Leads"],["pending","Pending"],["followups","Follow-ups"],["completed","Completed"],["data_entries","User Entries"],["all","All"]]
    : currentUser?.role === "user"
      ? [["all","My Data Entries"]]
      : [["pending","Pending"],["followups","Follow-ups"],["completed","Completed"],["all","All My Tasks"]];

  return (
    <div className="w-full max-w-none px-1.5 py-2 md:px-2">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2 md:mb-3 md:gap-3">
        <div>
          <h1 className="text-lg font-black tracking-tight text-slate-900 md:text-2xl">Tasks</h1>
          <p className="mt-0.5 text-[10px] font-medium text-slate-400 md:text-xs">{tasks.length} total task{tasks.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-1.5 md:gap-2">
          {isAdmin && <button onClick={() => setShowLimits(true)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-700 shadow-sm hover:border-blue-300 md:px-4 md:py-2 md:text-xs">
            Task Limits
          </button>}
          {canManualLeadEntry && <button onClick={() => setCreating((c) => !c)}
            className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-sm transition-colors hover:bg-blue-700 md:px-4 md:py-2 md:text-xs">
            {creating ? "Cancel" : "+ Manual Lead Entry"}
          </button>}
        </div>
      </div>

      {showLimits && (
        <ConsultantLimitCard
          executives={executives}
          onClose={() => setShowLimits(false)}
          onSaved={(updated) => setExecutives((items) => items.map((item) => item.id === updated.id ? updated : item))}
        />
      )}
      <LimitReachedModal message={limitNotice} onClose={() => setLimitNotice("")} />

      {creating && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={() => setCreating(false)}>
        <form onSubmit={handleCreate} onMouseDown={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
          <div className="mb-4">
            <h2 className="text-sm font-black text-slate-900">Manual Lead Entry</h2>
            <p className="mt-1 text-xs text-slate-500">Lead-এর তথ্য লিখুন। প্রয়োজন হলে অতিরিক্ত data field যোগ করুন।</p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {[
              ["full_name", "Name", "text", true],
              ["email", "Email", "email", false],
              ["mobile", "Phone Number", "tel", true],
              ["age", "Age", "number", false],
            ].map(([key, label, type, required]) => (
              <label key={key}>
                <span className="mb-1 block text-[11px] font-bold text-slate-600">
                  {label} {required && <span className="text-rose-600">*</span>}
                </span>
                <input
                  required={required}
                  type={type}
                  className="input"
                  value={form.data[key]}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    data: { ...current.data, [key]: event.target.value },
                  }))}
                />
              </label>
            ))}
            <label>
              <span className="mb-1 block text-[11px] font-bold text-slate-600">Profession</span>
              <select className="input" value={form.data.profession} onChange={(event) => setForm((current) => ({ ...current, data: { ...current.data, profession: event.target.value } }))}>
                <option value="">Select profession</option>
                {PROFESSION_OPTIONS.map((profession) => <option key={profession} value={profession}>{profession}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-[11px] font-bold text-slate-600">Location</span>
              <input className="input" value={form.data.location} onChange={(event) => setForm((current) => ({ ...current, data: { ...current.data, location: event.target.value } }))} />
            </label>
            <label className="md:col-span-2">
              <span className="mb-1 block text-[11px] font-bold text-slate-600">Remarks</span>
              <textarea
                rows={3}
                className="input"
                value={form.data.remarks}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  data: { ...current.data, remarks: event.target.value },
                }))}
              />
            </label>

            {customFields.map((field, index) => (
              <div key={field.id} className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 md:col-span-2">
                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_36px]">
                  <input
                    className="input"
                    placeholder="Field name (e.g. Profession)"
                    value={field.label}
                    onChange={(event) => setCustomFields((items) => items.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, label: event.target.value } : item
                    ))}
                  />
                  <input
                    className="input"
                    placeholder="Field value"
                    value={field.value}
                    onChange={(event) => setCustomFields((items) => items.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, value: event.target.value } : item
                    ))}
                  />
                  <button
                    type="button"
                    onClick={() => setCustomFields((items) => items.filter((_, itemIndex) => itemIndex !== index))}
                    className="rounded-lg border border-rose-200 bg-white text-lg font-bold text-rose-600"
                    aria-label="Remove custom field"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setCustomFields((items) => [...items, { id: crypto.randomUUID(), label: "", value: "" }])}
              className="w-fit rounded-lg border border-dashed border-blue-300 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700"
            >
              + Add New Data Field
            </button>

          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={leadSubmitting} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60">
              {leadSubmitting ? "Saving..." : "Save Manual Lead"}
            </button>
            <button type="button" onClick={() => setCreating(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
          </div>
        </form>
        </div>
      )}

      {/* Search + sort — always one row, wraps compactly on narrow screens */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm md:mb-3 md:gap-2 md:p-2.5">
        <div className="relative min-w-[120px] flex-1 basis-[140px]">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 md:left-3.5 md:h-4 md:w-4" />
          <input
            type="text"
            placeholder="নাম, task বা program দিয়ে খুঁজুন..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-7 pr-2 text-[11px] outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50 md:py-2 md:pl-9 md:pr-3 md:text-sm"
          />
        </div>
        <div className="shrink-0"><SortDropdown value={sortKey} onChange={setSortKey} options={SORT_OPTIONS} /></div>
        <div className="shrink-0"><PeriodRangeFilter onChange={setEntryDateRange} /></div>
        {isAdmin && tab === "data_entries" && (
          <select value={entryUser} onChange={(e) => setEntryUser(e.target.value)}
            className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-semibold text-slate-600 outline-none focus:border-blue-500 md:px-3 md:py-2 md:text-xs">
            <option value="">All Users</option>
            {[...new Map(tasks.filter((t) => t.created_by).map((t) => [t.created_by, t.creator_name || "Unknown User"])).entries()]
              .map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        )}
      </div>

      <div className="mb-2 flex flex-wrap gap-1 md:mb-3 md:gap-1.5">
        {tabOptions.map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k); setSelected(new Set()); }}
            className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all md:px-4 md:py-1.5 md:text-xs ${
              tab===k
                ? "bg-blue-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:text-blue-600"
            }`}>
            {l} ({tabCounts[k]})
          </button>
        ))}
      </div>

      {isAdmin && selected.size > 0 && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2 md:mb-3 md:px-3.5 md:py-2.5">
          <span className="text-[10px] font-bold text-blue-800 md:text-xs">{selected.size} selected</span>
          <div className="flex flex-wrap items-center justify-end gap-1.5 md:gap-2">
            <ExecutivePicker executives={executives} workload={workload} onSelect={handleBulkAssign} label="Bulk Assign" />
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-rose-700 md:px-4 md:py-2 md:text-xs"
            >
              <TrashIcon className="h-3.5 w-3.5" /> Delete Selected
            </button>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={() => !bulkDeleting && setShowDeleteConfirm(false)}>
          <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-700">
              <TrashIcon className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-black text-slate-900">Selected tasks delete করবেন?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              আপনি <strong>{selected.size}টি task</strong> স্থায়ীভাবে delete করতে যাচ্ছেন। এই action undo করা যাবে না।
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={bulkDeleting}
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkDeleting}
                onClick={handleBulkDelete}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {bulkDeleting ? "Deleting..." : `Confirm Delete (${selected.size})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="mb-2 rounded-lg bg-rose-50 px-2.5 py-2 text-[11px] text-rose-600 ring-1 ring-rose-200 md:mb-3 md:px-3 md:text-xs">{error}</div>}
      {loading && <div className="py-10 text-center text-sm text-slate-500">লোড হচ্ছে…</div>}

      {!loading && visible.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-400">
          কোনো task নেই।
        </div>
      )}

      {/* Desktop / tablet table — hidden on mobile */}
      {!loading && visible.length > 0 && (
        <div className="hidden min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
          <ListScrollArea>
            <table className="task-list-table w-max min-w-[720px] table-auto border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {isAdmin && (
                    <th className="w-10 px-4 py-2">
                      <input type="checkbox" checked={allSelected} onChange={() => toggleSelectAll(allIds)} className="h-4 w-4 rounded border-slate-300" />
                    </th>
                  )}
                  <th className={`${taskColumnWidths.customer} px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500`}>Guest / Task</th>
                  {showLeadSummary && <>
                    <th className="w-[5%] px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">Age</th>
                    <th className="w-[11%] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Profession</th>
                    <th className="w-[16%] px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Remarks / Problem</th>
                  </>}
                  <th className={`${taskColumnWidths.program} px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500`}>Program</th>
                  <th className={`${taskColumnWidths.stage} px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500`}>Stage</th>
                  {isAdmin && <th className={`${taskColumnWidths.assignee} px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500`}>Assignee</th>}
                  {isDataEntriesTab && <th className="w-[12%] px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Entered By</th>}
                  <th className={`${taskColumnWidths.created} px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500`}>Created</th>
                  <th className={`${taskColumnWidths.actions} px-4 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => {
                  const isLead = Boolean(t.customer_id);
                  const isAssigned = Boolean(t.assigned_to && String(t.assigned_to).trim());
                  const taskCategory = t.status === "completed"
                    ? "completed"
                    : isAssigned
                      ? "assigned"
                      : "unassigned";
                  const canFillForm = currentUser.role !== "user" && isLead && t.status === "pending" && (isAdmin || t.assigned_to === currentUser.id);
                  const formOpen = openFormFor === t.id;
                  const summary = taskSummary(t);
                  const stageClass = STAGE_COLORS[t.stage] || "bg-slate-50 text-slate-600 ring-slate-200";
                  const rowClass = formOpen
                    ? "border-l-4 border-l-blue-600 bg-blue-100/80"
                    : isLead && STAGE_ROW_COLORS[t.stage]
                      ? STAGE_ROW_COLORS[t.stage]
                    : taskCategory === "completed"
                      ? "border-l-4 border-l-emerald-500 bg-emerald-50/80 hover:bg-emerald-100/80"
                      : taskCategory === "assigned"
                        ? "border-l-4 border-l-blue-500 bg-blue-50/80 hover:bg-blue-100/80"
                        : "border-l-4 border-l-amber-500 bg-amber-50/80 hover:bg-amber-100/80";
                  const avatarClass = taskCategory === "completed"
                    ? "bg-emerald-600"
                    : taskCategory === "assigned"
                      ? "bg-blue-600"
                      : "bg-amber-500";
                  return (
                    <Fragment key={t.id}>
                      <tr
                        onClick={(event) => {
                          if (event.target.closest("button,input,select,a")) return;
                          if (canFillForm && tab !== "completed") {
                            setOpenFormFor(formOpen ? null : t.id);
                            return;
                          }
                          openReadOnlyDetails(t);
                        }}
                        className={`cursor-pointer border-b border-slate-100 last:border-b-0 transition-colors ${rowClass}`}>
                        {isAdmin && (
                          <td className="px-4 py-2.5 align-middle">
                            <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleSelect(t.id)} className="h-4 w-4 rounded border-slate-300" />
                          </td>
                        )}
                        <td className="px-4 py-2.5 align-middle">
                          <div className="flex items-center gap-2.5">
                            <ProfileAvatar
                              name={t.customer_name || t.title}
                              imageUrl={t.customer_image_url}
                              fallbackClassName={avatarClass}
                            />
                            <div className="min-w-0">
                              <div title={t.customer_name || t.title || ""} className={`overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold text-slate-900 ${t.status==="completed" ? "line-through text-slate-400" : ""}`}>
                                {t.customer_name || t.title || "—"}
                              </div>
                              {summary.mobile && <div className="text-[10px] text-slate-500">{summary.mobile}</div>}
                              {isLead && <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Lead</span>}
                            </div>
                          </div>
                        </td>
                        {showLeadSummary && <>
                          <td className="px-2 py-2.5 text-center align-middle text-xs font-bold text-slate-600">
                            {summary.age !== "" && summary.age != null ? summary.age : "—"}
                          </td>
                          <td className="px-3 py-2.5 align-middle text-xs font-medium leading-5 text-slate-600">
                            <span className="break-words">{summary.profession || "—"}</span>
                          </td>
                          <td className="max-w-[240px] px-4 py-2.5 align-middle text-xs">
                            <div className="text-slate-700" title={String(summary.remarks || "")}><span className="font-semibold">Remarks:</span> {truncateWords(summary.remarks)}</div>
                            <div className="mt-0.5 text-slate-500" title={String(summary.problem || "")}><span className="font-semibold">Problem:</span> {truncateWords(summary.problem)}</div>
                          </td>
                        </>}
                        <td className="px-4 py-2.5 align-middle text-xs font-medium text-slate-500">{t.project_name || "—"}</td>
                        <td className="px-4 py-2.5 align-middle">
                          {t.stage ? (
                            <span className={`inline-flex max-w-full whitespace-normal break-words rounded-md px-2 py-1 text-[10px] font-bold leading-tight ring-1 ring-inset ${stageClass}`}>{t.stage}</span>
                          ) : <span className="text-xs text-slate-300">—</span>}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-2.5 align-middle text-xs font-medium text-slate-500">
                            {t.assignee_name ? (
                              <span className="flex min-w-0 items-center gap-2">
                                <ProfileAvatar name={t.assignee_name} imageUrl={t.assignee_image_url} className="h-6 w-6" fallbackClassName="bg-slate-500" />
                                <span className="min-w-0 break-words">{t.assignee_name}</span>
                              </span>
                            ) : <span className="italic text-slate-300">Unassigned</span>}
                          </td>
                        )}
                        {isAdmin && tab === "data_entries" && (
                          <td className="px-4 py-2.5 align-middle text-xs font-semibold text-slate-600">
                            {t.creator_name || "Unknown User"}
                          </td>
                        )}
                        <td className="px-4 py-2.5 align-middle text-xs text-slate-400">
                          <div>Created: {new Date(t.created_at).toLocaleString("en-GB")}</div>
                          {t.assigned_at && <div className="mt-0.5 font-semibold text-blue-700">Assigned: {new Date(t.assigned_at).toLocaleString("en-GB")}</div>}
                          {t.completed_at && <div className="mt-0.5 font-semibold text-emerald-700">Completed: {new Date(t.completed_at).toLocaleString("en-GB")}</div>}
                          {t.due_date && <div className="mt-0.5 font-semibold text-amber-700">Follow-up set for: {new Date(t.due_date).toLocaleString("en-GB")}</div>}
                        </td>
                        <td className="px-4 py-2.5 align-middle">
                          <div className="flex min-w-0 flex-col items-stretch gap-1.5">
                            {isAdmin && (
                              <ExecutivePicker executives={executives} workload={workload}
                                onSelect={(id) => handleAssign(t, id)}
                                label={t.assignee_name ? "Reassign" : "Assign"}
                                buttonClassName="w-full" />
                            )}
                            {!isLead && (
                              <input type="checkbox" checked={t.status==="completed"} onChange={() => toggleStatus(t)} className="mx-auto h-4 w-4 rounded border-slate-300" title="Toggle complete" />
                            )}
                            {canFillForm && (
                              <button type="button" onClick={() => toggleTaskForm(t.id)}
                                className={`flex w-full items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-bold leading-tight transition-colors ${formOpen ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100"}`}>
                                {formOpen ? "Close" : "Open"}
                                {formOpen ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {formOpen && (
                        <tr key={`${t.id}-form`} className="border-b border-slate-100 bg-slate-50/70">
                          <td colSpan={(isAdmin ? (tab === "data_entries" ? 8 : 7) : 5) + (showLeadSummary ? 3 : 0)} className="p-4">
                            <FollowUpForm task={t} currentUser={currentUser} onSubmit={(data) => handleFollowUpSubmit(t, data)} onCancel={() => setOpenFormFor(null)} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </ListScrollArea>
        </div>
      )}

      {/* Mobile compact card list — shown only below md breakpoint */}
      {!loading && visible.length > 0 && (
        <div className="md:hidden">
          {isAdmin && (
            <label className="mb-1.5 flex items-center gap-1.5 px-0.5 text-[10px] font-bold text-slate-500">
              <input type="checkbox" checked={allSelected} onChange={() => toggleSelectAll(allIds)} className="h-3.5 w-3.5 rounded border-slate-300" />
              Select all ({visible.length})
            </label>
          )}
          <div className="space-y-1.5">
            {visible.map((t) => {
              const isLead = Boolean(t.customer_id);
              const isAssigned = Boolean(t.assigned_to && String(t.assigned_to).trim());
              const taskCategory = t.status === "completed"
                ? "completed"
                : isAssigned
                  ? "assigned"
                  : "unassigned";
              const canFillForm = currentUser.role !== "user" && isLead && t.status === "pending" && (isAdmin || t.assigned_to === currentUser.id);
              const formOpen = openFormFor === t.id;
              const summary = taskSummary(t);
              const stageClass = STAGE_COLORS[t.stage] || "bg-slate-50 text-slate-600 ring-slate-200";
              const accentClass = isLead && STAGE_BORDER_COLORS[t.stage]
                ? STAGE_BORDER_COLORS[t.stage]
                : taskCategory === "completed"
                  ? "border-l-emerald-500"
                  : taskCategory === "assigned"
                    ? "border-l-blue-500"
                    : "border-l-amber-500";
              const avatarClass = taskCategory === "completed"
                ? "bg-emerald-600"
                : taskCategory === "assigned"
                  ? "bg-blue-600"
                  : "bg-amber-500";
              return (
                <div key={`m-${t.id}`}
                  className={`min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm border-l-4 ${accentClass} ${formOpen ? "ring-1 ring-blue-300" : ""}`}>
                  <div
                    onClick={(event) => {
                      if (event.target.closest("button,input,select,a")) return;
                      if (canFillForm && tab !== "completed") {
                        setOpenFormFor(formOpen ? null : t.id);
                        return;
                      }
                      openReadOnlyDetails(t);
                    }}
                    className={`flex cursor-pointer flex-col gap-1 p-2 ${formOpen ? "bg-blue-50/70" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {isAdmin && (
                          <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleSelect(t.id)} className="h-3.5 w-3.5 shrink-0 rounded border-slate-300" />
                        )}
                        <ProfileAvatar name={t.customer_name || t.title} imageUrl={t.customer_image_url} fallbackClassName={avatarClass} className="h-6 w-6 shrink-0 text-[10px]" />
                        <div className="min-w-0">
                          <div className={`truncate text-[12px] font-bold leading-tight text-slate-900 ${t.status === "completed" ? "text-slate-400 line-through" : ""}`}>
                            {t.customer_name || t.title || "—"}
                          </div>
                          <div className="truncate text-[10px] leading-tight text-slate-500">
                            {summary.mobile || "—"}
                            {summary.age !== "" && summary.age != null ? ` · ${summary.age}y` : ""}
                            {summary.profession ? ` · ${summary.profession}` : ""}
                          </div>
                        </div>
                      </div>
                      {t.stage && (
                        <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold leading-tight ring-1 ring-inset ${stageClass}`}>{t.stage}</span>
                      )}
                    </div>

                    {(summary.remarks || summary.problem) && (
                      <div className="truncate text-[10px] leading-tight text-slate-600">
                        {summary.remarks ? <><span className="font-semibold">R:</span> {truncateWords(summary.remarks, 6)} </> : null}
                        {summary.problem ? <><span className="font-semibold">P:</span> {truncateWords(summary.problem, 6)}</> : null}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9px] leading-tight text-slate-400">
                      {t.project_name && <span className="font-semibold text-slate-500">{t.project_name}</span>}
                      {isAdmin && (t.assignee_name ? <span>→ {t.assignee_name}</span> : <span className="italic">Unassigned</span>)}
                      {isAdmin && tab === "data_entries" && t.creator_name && <span>by {t.creator_name}</span>}
                      <span>{new Date(t.created_at).toLocaleDateString("en-GB")}</span>
                      {t.due_date && <span className="font-semibold text-amber-700">FU {new Date(t.due_date).toLocaleDateString("en-GB")}</span>}
                    </div>

                    {(isAdmin || !isLead || canFillForm) && (
                      <div className="mt-0.5 flex flex-wrap items-center gap-1" onClick={(event) => event.stopPropagation()}>
                        {isAdmin && (
                          <ExecutivePicker executives={executives} workload={workload}
                            onSelect={(id) => handleAssign(t, id)}
                            label={t.assignee_name ? "Reassign" : "Assign"}
                            buttonClassName="!px-2 !py-1 !text-[10px]" />
                        )}
                        {!isLead && (
                          <label className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                            <input type="checkbox" checked={t.status === "completed"} onChange={() => toggleStatus(t)} className="h-3.5 w-3.5 rounded border-slate-300" /> Done
                          </label>
                        )}
                        {canFillForm && (
                          <button type="button" onClick={() => toggleTaskForm(t.id)}
                            className={`ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold ${formOpen ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700"}`}>
                            {formOpen ? "Close" : "Open"}
                            {formOpen ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {formOpen && (
                    <div className="border-t border-slate-100 bg-slate-50/70 p-2">
                      <FollowUpForm task={t} currentUser={currentUser} onSubmit={(data) => handleFollowUpSubmit(t, data)} onCancel={() => setOpenFormFor(null)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {detailLoading && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/30"><div className="rounded-xl bg-white px-5 py-3 text-xs font-bold text-slate-600 shadow-xl">Details loading...</div></div>}
      {taskDetail && <ReadOnlyTaskDetails detail={taskDetail} onClose={() => setTaskDetail(null)} />}

      <style>{`.input{width:100%;border:1px solid #E2E8F0;border-radius:8px;padding:9px 11px;font-size:13px;outline:none;background:#fff;color:#0F172A}.input:focus{border-color:#2563EB;box-shadow:0 0 0 3px #EFF6FF}`}</style>
    </div>
  );
}

function ReadOnlyTaskDetails({ detail, onClose }) {
  const registrationData = Object.fromEntries(Object.entries(detail.registration_data || {}).filter(([key]) => !["manual_field_labels"].includes(key)));
  const arrangedRegistration = arrangeDataEntries(registrationData);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={onClose}>
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900">{detail.task.customer_name || detail.task.title}</h2>
            <p className="text-xs text-slate-500">Read-only registration, task completion এবং follow-up history</p>
          </div>
          <button onClick={onClose} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600">Close</button>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
          <h3 className="mb-3 text-xs font-black uppercase tracking-wide text-emerald-700">Registration Data</h3>
          <ArrangedReadOnlyValues arranged={arrangedRegistration} />
        </div>

        <div className="mt-4 space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wide text-indigo-700">Task Completion & Follow-up Data</h3>
          {detail.history?.map((entry) => {
            const values = {
              Stage: entry.stage,
              "Remarks / Problem": entry.customer_problem,
              "Communicator Remarks": entry.executive_remarks,
              "Follow-up Date": entry.next_following_date || entry.due_date,
              "Follow-up Reason": entry.followup_reason,
              ...(entry.extra_data || {}),
            };
            const arranged = arrangeDataEntries(values);
            return (
              <div key={entry.id} className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div><span className="rounded-full bg-indigo-600 px-2 py-1 text-[10px] font-black text-white">{entry.kind}</span><span className="ml-2 text-xs font-bold text-slate-600">{entry.consultant || "Unassigned"}</span></div>
                  <div className="text-right text-[10px] text-slate-500">{new Date(entry.completed_at || entry.created_at).toLocaleString("en-GB")} · {entry.status}</div>
                </div>
                <ArrangedReadOnlyValues arranged={arranged} compact />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ArrangedReadOnlyValues({ arranged, compact = false }) {
  const groups = [
    ["Basic Personal Information", arranged.personal],
    ["Follow-up Information", arranged.followup],
    ["Other Information", arranged.other],
  ];
  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {groups.map(([title, entries]) => entries.length > 0 && (
        <div key={title}>
          <div className="mb-1.5 text-[9px] font-black uppercase tracking-wide text-slate-400">{title}</div>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map(([key, value]) => <ReadOnlyValue key={key} label={key} value={value} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReadOnlyValue({ label, value }) {
  const displayValue = label.toLowerCase().includes("date") && value
    ? new Date(value).toLocaleString("en-GB")
    : typeof value === "object" ? JSON.stringify(value) : String(value || "—");
  return (
    <div className="rounded-lg bg-white px-2.5 py-1.5">
      <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label.replace(/_/g, " ")}</div>
      <div className="mt-1 break-words text-xs font-semibold text-slate-700">{displayValue}</div>
    </div>
  );
}

function ConsultantLimitCard({ executives, onClose, onSaved }) {
  const [drafts, setDrafts] = useState(() => Object.fromEntries(executives.map((user) => [user.id, {
    daily_task_limit: user.daily_task_limit ?? "",
    daily_followup_limit: user.daily_followup_limit ?? "",
  }])));
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");

  function setLimit(userId, key, value) {
    setDrafts((current) => ({ ...current, [userId]: { ...current[userId], [key]: value } }));
  }

  async function save(user) {
    setSavingId(user.id);
    setError("");
    try {
      const values = drafts[user.id];
      const response = await updateUser(user.id, {
        daily_task_limit: values.daily_task_limit === "" ? null : Number(values.daily_task_limit),
        daily_followup_limit: values.daily_followup_limit === "" ? null : Number(values.daily_followup_limit),
      });
      onSaved(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Limit save করা যায়নি।");
    } finally {
      setSavingId("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={onClose}>
      <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">Communicator Daily Limits</h2>
            <p className="text-xs text-slate-500">খালি রাখলে Limitless হবে।</p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600">Close</button>
        </div>
        {error && <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</div>}
        <div className="space-y-2">
          {executives.map((user) => (
            <div key={user.id} className="grid items-end gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[1fr_170px_170px_auto]">
              <div>
                <div className="text-sm font-bold text-slate-900">{user.name}</div>
                <div className="text-[11px] text-slate-400">{user.email}</div>
              </div>
              <label className="text-[11px] font-bold text-slate-600">
                Task assign / day
                <input type="number" min="1" placeholder="Limitless" value={drafts[user.id]?.daily_task_limit ?? ""}
                  onChange={(event) => setLimit(user.id, "daily_task_limit", event.target.value)} className="input mt-1" />
              </label>
              <label className="text-[11px] font-bold text-slate-600">
                Follow-up / day
                <input type="number" min="1" placeholder="Limitless" value={drafts[user.id]?.daily_followup_limit ?? ""}
                  onChange={(event) => setLimit(user.id, "daily_followup_limit", event.target.value)} className="input mt-1" />
              </label>
              <button onClick={() => save(user)} disabled={savingId === user.id}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
                {savingId === user.id ? "Saving..." : "Save"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FollowUpForm({ task, currentUser, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    customer_problem: task.customer_problem || "",
    stage: task.stage || "", next_following_date: task.next_following_date ? task.next_following_date.slice(0, 16) : "",
    followup_reason: task.followup_reason || "", followup_extra_data: task.followup_extra_data || {},
  });
  const [customFields, setCustomFields] = useState(() => Object.entries(task.followup_extra_data || {}).map(([label, value]) => ({
    id: crypto.randomUUID(), label, value: String(value ?? ""),
  })));
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [limitNotice, setLimitNotice] = useState("");
  const [callLogs, setCallLogs] = useState([]);
  const [logging, setLogging] = useState(false);
  const [callNotes, setCallNotes] = useState("");
  const [callReceived, setCallReceived] = useState("");
  const [callDuration, setCallDuration] = useState("");
  const [callConfig, setCallConfig] = useState({ provider: "Zoiper / System Dialer", uri_template: "tel:{phone}", country_code: "" });
  const [callStartedAt, setCallStartedAt] = useState(null);

  const regData = task.registration_data || {};
  const manualFieldLabels = regData.manual_field_labels || {};
  const phone = taskDataValue(task, "mobile", "phone", "phone_number", "phone number", "মোবাইল", "ফোন");

  useEffect(() => {
    Promise.all([listCallLogsByTask(task.id), getCallConfig()])
      .then(([logsResponse, configResponse]) => {
        setCallLogs(logsResponse.data);
        setCallConfig(configResponse.data);
      })
      .catch(() => {});
  }, [task.id]);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }
  function updateCustomFields(nextFields) {
    setCustomFields(nextFields);
    set("followup_extra_data", Object.fromEntries(nextFields.filter((field) => field.label.trim()).map((field) => [field.label.trim(), field.value])));
  }

  // Autosave draft function
  const saveDraft = useCallback(async (currentForm) => {
    // Only save the draft, do not mark as completed here
    await updateTask(task.id, {
      ...currentForm,
      next_following_date: currentForm.next_following_date ? new Date(currentForm.next_following_date).toISOString() : null,
      status: "pending", // Ensure status remains pending for draft saves
    });
  }, [task.id]);

  const { isSaving, isSaved, saveError: autosaveError, triggerSave } = useAutosave(form, saveDraft);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.stage) {
      setSubmitError("Stage অবশ্যই পূরণ করতে হবে।");
      return;
    }
    if (form.next_following_date && !form.followup_reason.trim()) {
      setSubmitError("পরবর্তী Follow-up date দিলে কেন Follow-up করবেন সেই note লিখুন।");
      return;
    }
    setSubmitError("");
    setSaving(true); // This saving state is for the final submission
    try {
      await triggerSave();
      await onSubmit({ ...form,
        next_following_date: form.next_following_date ? new Date(form.next_following_date).toISOString() : null });
    } catch (err) {
      const detail = err.response?.data?.detail || "Follow-up submit করা যায়নি।";
      if (/limit|পূর্ণ হয়েছে/i.test(detail)) setLimitNotice(detail);
      else setSubmitError(detail);
      setSaving(false);
    }
  }

  function handleCall() {
    if (!phone) return;
    const rawPhone = String(phone).trim();
    const normalizedPhone = rawPhone.startsWith("+") || !callConfig.country_code
      ? rawPhone
      : `${callConfig.country_code}${rawPhone.replace(/^0+/, "")}`;
    const template = callConfig.uri_template || "tel:{phone}";
    const callUri = template.replaceAll("{phone}", normalizedPhone);
    if (!/^(tel|sip|sips|callto|zoiper):/i.test(callUri)) {
      setSubmitError("Call URI Template অবশ্যই tel:, sip:, sips:, callto: অথবা zoiper: দিয়ে শুরু হতে হবে।");
      return;
    }
    setCallStartedAt(new Date());
    setCallReceived("");
    setCallDuration("");
    setCallNotes("");
    window.location.href = callUri;
  }

  async function handleLogCall() {
    if (callReceived === "") {
      setSubmitError("Call Received অথবা Not Received নির্বাচন করুন।");
      return;
    }
    setLogging(true);
    try {
      const endedAt = new Date();
      const measuredSeconds = callStartedAt
        ? Math.max(0, Math.round((endedAt.getTime() - callStartedAt.getTime()) / 1000))
        : 0;
      const res = await createCallLog({
        task_id: task.id,
        customer_id: task.customer_id,
        phone_number: phone,
        received: callReceived === "" ? null : callReceived === "yes",
        duration_seconds: callDuration ? parseInt(callDuration, 10) * 60 : measuredSeconds,
        notes: callNotes,
        provider: callConfig.provider,
        started_at: callStartedAt?.toISOString() || null,
        ended_at: endedAt.toISOString(),
      });
      setCallLogs((l) => [res.data, ...l]); // Update local call logs state
      setCallNotes(""); setCallReceived(""); setCallDuration(""); setCallStartedAt(null);
      setSubmitError("");
    } catch (requestError) {
      setSubmitError(requestError.response?.data?.detail || "Call log save করা যায়নি।");
    } finally { setLogging(false); }
  }

  const dataKeys = Object.keys(regData).filter((k) => !["project_id", "source", "manual_field_labels"].includes(k));
  const arrangedSubmittedData = arrangeDataEntries(Object.fromEntries(
    dataKeys.map((key) => [manualFieldLabels[key] || key, regData[key]]),
  ));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <LimitReachedModal message={limitNotice} onClose={() => setLimitNotice("")} />
      {/* Left: Guest submitted data (success-card style) */}
      <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">Guest Submitted Data</h3>
          {phone && (
            <button onClick={handleCall}
              className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700">
              <PhoneCallIcon className="h-3.5 w-3.5" /> Call via {callConfig.provider}
            </button>
          )}
        </div>

        {dataKeys.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">কোনো registration data নেই।</div>
        ) : (
          <ArrangedReadOnlyValues arranged={arrangedSubmittedData} />
        )}

        {/* Call logging box */}
        {(
          <div className="mt-4 min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 text-[10px] font-bold uppercase tracking-wide text-slate-500">Call শেষে Log Save করুন</span>
              {callStartedAt && <span className="text-[10px] font-bold text-emerald-600">Call started {callStartedAt.toLocaleTimeString("en-GB")}</span>}
            </div>
            <div className="grid min-w-0 grid-cols-2 gap-2">
              <select value={callReceived} onChange={(e) => setCallReceived(e.target.value)} className="input min-w-0 !py-1.5 !text-[11px]">
                <option value="">Received?</option>
                <option value="yes">Received</option>
                <option value="no">Not Received</option>
              </select>
              <input type="number" min="0" placeholder="Duration (min)" value={callDuration} onChange={(e) => setCallDuration(e.target.value)} className="input min-w-0 !py-1.5 !text-[11px]" />
            </div>
            <input placeholder="Call notes (optional)" value={callNotes} onChange={(e) => setCallNotes(e.target.value)} className="input mt-2 min-w-0 !py-1.5 !text-[11px]" />
            <button onClick={handleLogCall} disabled={logging}
              className="mt-2 block w-full min-w-0 rounded-md bg-blue-600 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              {logging ? "Saving…" : "Save Call Log"}
            </button>

            {callLogs.length > 0 && (
              <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-100 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  Call History ({callLogs.length})
                </div>
                {callLogs.map((c, i) => {
                  const StatusIcon = c.received === true ? CheckCircleIcon : c.received === false ? XCircleIcon : MinusCircleIcon;
                  const statusColor = c.received === true ? "text-emerald-600" : c.received === false ? "text-rose-600" : "text-slate-500";
                  return (
                    <div key={c.id} className={`px-2.5 py-2 text-[11px] ${i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>
                      <div className="flex items-center justify-between">
                        <span className={`flex items-center gap-1 font-bold ${statusColor}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {c.received === true ? "Received" : c.received === false ? "Not Received" : "Unknown"}
                        </span>
                        <span className="text-slate-400">{new Date(c.created_at).toLocaleString("en-GB")}</span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between text-slate-500">
                        <span>{c.executive_name} · {c.provider || "Dialer"}</span>
                        {c.duration_seconds > 0 && <span>{Math.round(c.duration_seconds/60)} min</span>}
                      </div>
                      {c.notes && <div className="mt-0.5 text-slate-700">{c.notes}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: Follow-up form */}
      <form onSubmit={handleSubmit} className="min-w-0 rounded-lg border border-slate-200 border-l-[3px] border-l-blue-600 bg-white p-4">
        <h3 className="mb-3 border-b border-slate-100 pb-2.5 text-xs font-bold uppercase tracking-wide text-slate-600">Follow-up Form</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">Remarks / Problem</label>
            <textarea className="input w-full" rows={2} placeholder="Remarks / Problem" value={form.customer_problem} onChange={(e) => set("customer_problem", e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">Stage <span className="text-rose-600">*</span></label>
            <select required className="input w-full" value={form.stage} onChange={(e) => { set("stage", e.target.value); setSubmitError(""); }}>
              <option value="">Stage *</option>
              {STAGE_OPTIONS.map((s) => <option key={s} value={s} style={{ color: STAGE_HEX[s], fontWeight: 700 }}>● {s}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">Next follow-up date</label>
            <input className="input w-full" type="datetime-local" value={form.next_following_date} onChange={(e) => set("next_following_date", e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">
              Follow-up note {form.next_following_date ? <span className="text-rose-600">*</span> : null}
            </label>
            <textarea className="input w-full" rows={2} placeholder="কেন next follow-up করছেন / Follow-up note" value={form.followup_reason} onChange={(e) => set("followup_reason", e.target.value)} />
          </div>

          {customFields.map((field, index) => (
            <div key={field.id} className="col-span-2 grid grid-cols-[1fr_1fr_36px] gap-2 rounded-lg border border-blue-100 bg-blue-50/50 p-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600">Field name</label>
                <input className="input" placeholder="Field name" value={field.label} onChange={(event) => {
                  const next = customFields.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item);
                  updateCustomFields(next);
                }} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600">Field value</label>
                <input className="input" placeholder="Field value" value={field.value} onChange={(event) => {
                  const next = customFields.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item);
                  updateCustomFields(next);
                }} />
              </div>
              <button type="button" onClick={() => updateCustomFields(customFields.filter((_, itemIndex) => itemIndex !== index))}
                className="rounded-lg border border-rose-200 bg-white text-lg font-bold text-rose-600">×</button>
            </div>
          ))}
          <button type="button" onClick={() => updateCustomFields([...customFields, { id: crypto.randomUUID(), label: "", value: "" }])}
            className="col-span-2 rounded-lg border border-dashed border-blue-300 bg-blue-50 py-2 text-xs font-bold text-blue-700">
            + Add New Field
          </button>
        </div>
        {submitError && <div className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{submitError}</div>}
        {autosaveError && <div className="mt-2 text-xs text-rose-600">{autosaveError}</div>}
        <div className="mt-4 flex items-center gap-3">
          {isSaving && (
            <span className="flex items-center gap-1 text-xs font-semibold text-slate-500">
              <LoaderIcon className="h-3.5 w-3.5 animate-spin" /> Saving draft...
            </span>
          )}
          {isSaved && (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <CheckCircleIcon className="h-3.5 w-3.5" /> Draft Saved
            </span>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => triggerSave()} disabled={isSaving} className="rounded-md bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{isSaving ? "Saving…" : "Save Draft"}</button>
            <button type="submit" disabled={saving} className="rounded-md bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{saving ? "Saving…" : "Submit & Complete"}</button>
            <button type="button" onClick={onCancel} className="rounded-md border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      </form>
    </div>
  );
}