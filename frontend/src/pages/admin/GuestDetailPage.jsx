import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getCustomer, updateCustomer, deleteCustomer, listCustomerFields, replaceCustomerFields,
  listCallLogsByCustomer, listCustomerFollowups, createCustomerFollowup, updateCustomerFollowup, listUsers,
} from "../../api/guest.js";
import ProfileAvatar from "../../components/ProfileAvatar.jsx";
import { useAutosave } from "../../hooks/useAutosave.js"; // Import the new hook
import { useRealtimeRefresh } from "../../realtime/RealtimeContext.jsx";
import LimitReachedModal from "../../components/LimitReachedModal.jsx";
import { arrangeDataEntries } from "../../utils/dataArrangement.js";
import {
  ArrowLeftIcon, PhoneIcon, MailIcon, ClipboardIcon, InfoIcon,
  HistoryIcon, PhoneCallIcon, CheckCircleIcon, XCircleIcon, MinusCircleIcon,
  ChevronDownIcon, ChevronUpIcon, PlusIcon, TrashIcon, LoaderIcon,
} from "../../components/Icons.jsx";

const STAGE_OPTIONS = ["Interested","Dropped","Counselling","Associate","Course Acc","Potential Batch","QG","Quantier","QPM","Ardentiar","Organier","Foreigner"];
const STAGE_COLORS = {
  Interested: "bg-sky-100 text-sky-800", Dropped: "bg-rose-100 text-rose-800",
  Counselling: "bg-amber-100 text-amber-800", Associate: "bg-violet-100 text-violet-800",
  "Course Acc": "bg-indigo-100 text-indigo-800", "Potential Batch": "bg-teal-100 text-teal-800",
  QG: "bg-emerald-100 text-emerald-800", Quantier: "bg-green-100 text-green-800",
  QPM: "bg-fuchsia-100 text-fuchsia-800", Ardentiar: "bg-orange-100 text-orange-800",
  Organier: "bg-cyan-100 text-cyan-800", Foreigner: "bg-lime-100 text-lime-800",
};
const STAGE_HEX = {
  Interested: "#0369a1", Dropped: "#be123c", Counselling: "#b45309", Associate: "#6d28d9",
  "Course Acc": "#4338ca", "Potential Batch": "#0f766e", QG: "#047857", Quantier: "#15803d",
  QPM: "#a21caf", Ardentiar: "#c2410c", Organier: "#0e7490", Foreigner: "#4d7c0f",
};
// Solid dot color for the avatar status indicator / timeline markers
const STAGE_DOT = {
  Interested: "bg-sky-500", Dropped: "bg-rose-500", Counselling: "bg-amber-500", Associate: "bg-violet-500",
  "Course Acc": "bg-indigo-500", "Potential Batch": "bg-teal-500", QG: "bg-emerald-500", Quantier: "bg-green-500",
  QPM: "bg-fuchsia-500", Ardentiar: "bg-orange-500", Organier: "bg-cyan-500", Foreigner: "bg-lime-500",
};
function toDateInput(iso) { return iso ? iso.slice(0, 10) : ""; }

const TABS = [
  { key: "info", label: "Profile", icon: InfoIcon },
  { key: "history", label: "History", icon: HistoryIcon },
  { key: "calls", label: "Call Log", icon: PhoneCallIcon },
];

export default function CustomerDetailPage({ currentUser, onLoggedOut }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isAdmin = currentUser?.role === "admin";
  const isDataUser = currentUser?.role === "user";
  const [customer, setCustomer] = useState(null);
  const [fieldSchema, setFieldSchema] = useState([]);
  const [form, setForm] = useState(null);
  const [callLogs, setCallLogs] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [executives, setExecutives] = useState([]);
  const [followupDateFilter, setFollowupDateFilter] = useState("");
  const [followupSaving, setFollowupSaving] = useState(false);
  const [followupError, setFollowupError] = useState("");
  const [showFollowupForm, setShowFollowupForm] = useState(false);
  const [limitNotice, setLimitNotice] = useState("");
  const [crmForm, setCrmForm] = useState({ scheduled_at: "", note: "", result: "", stage: "", assigned_to: "" });
  const [addingField, setAddingField] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [activeTab, setActiveTab] = useState("info");
  const [historySearch, setHistorySearch] = useState("");

  const load = useCallback(() => {
    const requests = [getCustomer(id), listCustomerFields(), listCallLogsByCustomer(id), listCustomerFollowups(id)];
    if (isAdmin) requests.push(listUsers());
    Promise.all(requests)
      .then(([cRes, fRes, clRes, followupRes, usersRes]) => {
        setCustomer(cRes.data);
        setFieldSchema(fRes.data);
        setCallLogs(clRes.data);
        setFollowups(followupRes.data);
        if (usersRes) setExecutives(usersRes.data.filter((user) => user.role === "executive" && user.is_active));
        setCrmForm((current) => ({ ...current, stage: current.stage || cRes.data.stage || "" }));
        setForm({
          full_name: cRes.data.full_name || "",
          mobile: cRes.data.mobile || "",
          email: cRes.data.email || "",
          location: cRes.data.location || "",
          profession: cRes.data.profession || "",
          age: cRes.data.age || "",
          extra_data: { ...(cRes.data.extra_data || {}) },
        });
      })
      .catch((err) => {
        if (err.response?.status === 401) onLoggedOut();
        else if (err.response?.status === 404) navigate("/admin/customers");
      });
  }, [id, navigate, onLoggedOut, isAdmin]);

  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(
    ["customers", "registrations", "tasks", "call_logs", "customer_fields", "customer_communications"],
    load,
  );

  function set(key, val) { setForm((f) => ({ ...f, [key]: val })); }
  function setExtra(key, val) { setForm((f) => ({ ...f, extra_data: { ...f.extra_data, [key]: val } })); }

  const saveCustomer = useCallback(async (currentForm) => {
    const res = await updateCustomer(id, {
      ...currentForm,
      age: currentForm.age ? parseInt(currentForm.age, 10) : null,
    });
    setCustomer((c) => ({ ...c, ...res.data }));
    return res.data; // Return updated data if needed by the hook
  }, [id]);

  // Use the autosave hook
  const { isSaving, isSaved, saveError, triggerSave } = useAutosave(form, saveCustomer, 1000, !isDataUser);

  async function handleFollowupSave(event) {
    event.preventDefault();
    if (!crmForm.scheduled_at || !crmForm.stage) {
      setFollowupError("Follow-up date/time এবং stage নির্বাচন করুন।");
      return;
    }
    setFollowupSaving(true);
    setFollowupError("");
    try {
      const response = await createCustomerFollowup(id, {
        ...crmForm,
        scheduled_at: new Date(crmForm.scheduled_at).toISOString(),
        assigned_to: isAdmin ? crmForm.assigned_to || null : currentUser.id,
      });
      setFollowups((items) => [response.data, ...items]);
      setCrmForm({ scheduled_at: "", note: "", result: "", stage: "", assigned_to: "" });
      setShowFollowupForm(false);
    } catch (requestError) {
      const detail = requestError.response?.data?.detail || "Follow-up save করা যায়নি।";
      if (/limit|পূর্ণ হয়েছে/i.test(detail)) setLimitNotice(detail);
      else setFollowupError(detail);
    } finally {
      setFollowupSaving(false);
    }
  }

  async function handleFollowupUpdate(followupId, data) {
    try {
      const response = await updateCustomerFollowup(id, followupId, data);
      setFollowups((items) => items.map((item) => item.id === followupId ? response.data : item));
    } catch (requestError) {
      const detail = requestError.response?.data?.detail || "Follow-up update করা যায়নি।";
      if (/limit|পূর্ণ হয়েছে/i.test(detail)) setLimitNotice(detail);
      else setFollowupError(detail);
    }
  }

  async function handleDelete() {
    if (!confirm(`"${customer.full_name || "এই"}" profile মুছে ফেলবেন?`)) return;
    await deleteCustomer(id);
    navigate("/admin/customers");
  }

  async function handleAddField() {
    if (!newFieldLabel.trim()) return;
    const key = newFieldLabel.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const newField = { key, label: newFieldLabel.trim(), type: newFieldType, options: [], position: fieldSchema.length };
    const nextSchema = [...fieldSchema, newField];
    try {
      const res = await replaceCustomerFields(nextSchema);
      setFieldSchema(res.data);
      setNewFieldLabel(""); setNewFieldType("text"); setAddingField(false);
    } catch {
      alert("Field যোগ করা যায়নি।");
    }
  }

  if (!customer || !form) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
          <LoaderIcon className="h-4 w-4 animate-spin text-indigo-500" /> লোড হচ্ছে…
        </div>
      </div>
    );
  }

  const historyCount = (customer.registrations?.length || 0) + (customer.lead_history?.length || 0) + followups.length;
  const dotColor = STAGE_DOT[form.stage] || "bg-slate-400";
  const initials = (form.full_name || "").trim().charAt(0).toUpperCase() || "?";
  const stageHex = STAGE_HEX[form.stage] || "#6366f1";
  const assignmentDateLabel = customer.last_assigned_at
    ? new Date(customer.last_assigned_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <button onClick={() => navigate("/admin/customers")} className="back-button mb-4">
        <ArrowLeftIcon className="h-3.5 w-3.5" /> সব Guest
      </button>

      {/* ── Modern, responsive profile header (no photo — initials avatar) ── */}
      <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          {/* Identity block */}
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
            <div className="relative flex-shrink-0">
              <div
                className="flex h-16 w-16 select-none items-center justify-center rounded-2xl text-xl font-black text-white shadow-sm sm:h-20 sm:w-20 sm:text-2xl"
                style={{ background: `linear-gradient(135deg, ${stageHex}, ${stageHex}99)` }}
              >
                {initials}
              </div>
              <span className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white ${dotColor}`} />
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h1 className="text-lg font-black text-slate-900 sm:text-xl">{form.full_name || "নাম নেই"}</h1>
                {form.stage && (
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${STAGE_COLORS[form.stage] || "bg-slate-100 text-slate-700"}`}>
                    {form.stage}
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-slate-500 sm:justify-start">
                {form.mobile && (
                  <span className="flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-50 text-sky-500"><PhoneIcon className="h-3 w-3" /></span>
                    {form.mobile}
                  </span>
                )}
                {form.email && (
                  <span className="flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-50 text-violet-500"><MailIcon className="h-3 w-3" /></span>
                    {form.email}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-500"><ClipboardIcon className="h-3 w-3" /></span>
                  {customer.programs_count} programs
                </span>
                {form.location && <span>· {form.location}</span>}
              </div>
              {(customer.last_assigned_comm_name || assignmentDateLabel) && (
                <div className="mt-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700 sm:text-xs">
                  Last assigned to {customer.last_assigned_comm_name || "—"}
                  {assignmentDateLabel ? ` • ${assignmentDateLabel}` : ""}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-shrink-0 flex-wrap items-center justify-center gap-2.5 sm:justify-end">
            {!isDataUser && (
              <button onClick={() => triggerSave()} disabled={isSaving} className="rounded-full bg-indigo-600 px-3.5 py-2 text-[11px] font-bold text-white disabled:opacity-50">
                Save
              </button>
            )}
            {isSaving && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                <LoaderIcon className="h-3.5 w-3.5 animate-spin" /> Saving
              </span>
            )}
            {isSaved && !isSaving && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                <CheckCircleIcon className="h-3.5 w-3.5" /> Saved
              </span>
            )}
            {saveError && <span className="text-[11px] font-semibold text-rose-600">{saveError}</span>}
            {isAdmin && (
              <button onClick={handleDelete} className="flex items-center gap-1 rounded-full border border-slate-200 px-3.5 py-2 text-[11px] font-semibold text-slate-500 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600">
                <TrashIcon className="h-3.5 w-3.5" /> Delete
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-5 flex gap-5 overflow-x-auto border-t border-slate-100 pt-3">
          {TABS.map((t) => {
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`relative flex flex-shrink-0 items-center gap-1.5 pb-2.5 text-xs font-bold transition-colors ${
                  active ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
                {t.key === "history" && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-500"}`}>
                    {historyCount}
                  </span>
                )}
                {t.key === "calls" && callLogs.length > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-500"}`}>
                    {callLogs.length}
                  </span>
                )}
                {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-indigo-500" />}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "info" && (
        <fieldset disabled={isDataUser} className="grid grid-cols-1 items-start gap-5 disabled:opacity-90 xl:grid-cols-5">
          {/* Basic Information — styled as a compact "profile facts" list */}
          <div className="xl:col-span-2">
            <Card title="Profile">
              <div className="divide-y divide-slate-100">
                <ProfileRow label="নাম"><input className="uinput" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} /></ProfileRow>
                <ProfileRow label="মোবাইল *"><input required type="tel" className="uinput" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} /></ProfileRow>
                <ProfileRow label="ইমেইল"><input className="uinput" value={form.email} onChange={(e) => set("email", e.target.value)} /></ProfileRow>
                <ProfileRow label="Location"><input className="uinput" value={form.location} onChange={(e) => set("location", e.target.value)} /></ProfileRow>
                <ProfileRow label="Profession"><input className="uinput" value={form.profession} onChange={(e) => set("profession", e.target.value)} /></ProfileRow>
                <ProfileRow label="Age"><input type="number" className="uinput" value={form.age} onChange={(e) => set("age", e.target.value)} /></ProfileRow>

                {fieldSchema.map((f) => (
                  <ProfileRow key={f.key} label={f.label}>
                    {f.type === "textarea" ? (
                      <textarea rows={2} className="uinput resize-none" value={form.extra_data[f.key] || ""} onChange={(e) => setExtra(f.key, e.target.value)} />
                    ) : (
                      <input required={f.type === "tel"} type={f.type === "date" ? "date" : f.type === "tel" ? "tel" : "text"} className="uinput" value={form.extra_data[f.key] || ""} onChange={(e) => setExtra(f.key, e.target.value)} />
                    )}
                  </ProfileRow>
                ))}
              </div>

              {/* Add field */}
              {!isDataUser && (addingField ? (
                <div className="mt-4 flex flex-col gap-2 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/40 p-3">
                  <input placeholder="Field name" value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)} className="input" autoFocus />
                  <select value={newFieldType} onChange={(e) => setNewFieldType(e.target.value)} className="input">
                    <option value="text">Text</option>
                    <option value="textarea">Textarea</option>
                    <option value="date">Date</option>
                  </select>
                  <div className="flex gap-2">
                    <button onClick={handleAddField} className="flex-1 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 py-1.5 text-xs font-bold text-white">Add</button>
                    <button onClick={() => { setAddingField(false); setNewFieldLabel(""); }} className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-600">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingField(true)} className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2.5 text-xs font-semibold text-indigo-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40">
                  <PlusIcon className="h-3.5 w-3.5" /> Add Custom Field
                </button>
              ))}
            </Card>
          </div>

          {/* Follow-up history — styled as an "activity stream" timeline */}
          <div className="xl:col-span-3">
            <Card
              title={`Activity Stream · Follow-ups (${followups.length})`}
              action={!isDataUser && (
                <button type="button" onClick={() => setShowFollowupForm(true)} className="flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-500 to-violet-400 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm">
                  <PlusIcon className="h-3.5 w-3.5" /> New Follow-up
                </button>
              )}
            >
              <input type="date" value={followupDateFilter} onChange={(event) => setFollowupDateFilter(event.target.value)} className="input mb-4" />
              <div className="max-h-[560px] overflow-y-auto pr-1">
                <FollowupTimeline
                  followups={followups.filter((item) => !followupDateFilter || toDateInput(item.scheduled_at) === followupDateFilter)}
                  readOnly={isDataUser}
                  isAdmin={isAdmin}
                  executives={executives}
                  onUpdate={handleFollowupUpdate}
                />
              </div>
            </Card>
          </div>
        </fieldset>
      )}

      {activeTab === "history" && (
        <div className="mx-auto max-w-4xl">
          <Card title={`Registration & Lead History (${(customer.registrations?.length || 0) + countLeadContexts(customer.lead_history)})`}>
            <div className="space-y-2.5">
              <input
                className="input"
                placeholder="Registration, stage, remarks, communicator বা follow-up খুঁজুন..."
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
              />
              <RegistrationHistoryList registrations={(customer.registrations || []).filter((item) => !historySearch.trim() || JSON.stringify(item).toLowerCase().includes(historySearch.trim().toLowerCase()))} />
              <StandaloneLeadHistoryList entries={(customer.lead_history || []).filter((item) => !historySearch.trim() || JSON.stringify(item).toLowerCase().includes(historySearch.trim().toLowerCase()))} />
              {!customer.registrations?.length && !customer.lead_history?.length && (
                <div className="py-8 text-center text-xs text-slate-400">কোনো registration বা lead history নেই।</div>
              )}
            </div>
          </Card>
        </div>
      )}

      {activeTab === "calls" && (
        <div className="mx-auto max-w-3xl">
          <Card title={`Call Logs (${callLogs.length})`}>
            {callLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">কোনো call log নেই।</div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {callLogs.map((c) => {
                  const StatusIcon = c.received === true ? CheckCircleIcon : c.received === false ? XCircleIcon : MinusCircleIcon;
                  const statusColor = c.received === true ? "text-emerald-600" : c.received === false ? "text-rose-600" : "text-slate-500";
                  return (
                    <div key={c.id} className="rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-3">
                      <div className="flex items-center justify-between">
                        <span className={`flex items-center gap-1 text-xs font-bold ${statusColor}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {c.received === true ? "Received" : c.received === false ? "Not Received" : "Unknown"}
                        </span>
                        <span className="text-[10px] text-slate-400">{new Date(c.created_at).toLocaleDateString("en-GB")}</span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                        <span>{c.executive_name || "—"} · {c.provider || "Dialer"}</span>
                        {c.duration_seconds > 0 && <span>{Math.round(c.duration_seconds / 60)} min</span>}
                      </div>
                      {c.notes && <div className="mt-1.5 text-[11px] text-slate-600">{c.notes}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {showFollowupForm && !isDataUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]" onMouseDown={() => setShowFollowupForm(false)}>
          <form onSubmit={handleFollowupSave} onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">New Follow-up</h2>
              <button type="button" onClick={() => setShowFollowupForm(false)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600">Close</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <CompactField label="Stage" span2={!isAdmin}>
                <select className="input" value={crmForm.stage} onChange={(e) => setCrmForm((current) => ({ ...current, stage: e.target.value }))}>
                  <option value="">নির্বাচন করুন</option>
                  {STAGE_OPTIONS.map((s) => <option key={s} value={s} style={{ color: STAGE_HEX[s], fontWeight: 700 }}>● {s}</option>)}
                </select>
              </CompactField>
              {isAdmin && <CompactField label="Communicator">
                <select className="input" value={crmForm.assigned_to} onChange={(e) => setCrmForm((current) => ({ ...current, assigned_to: e.target.value }))}>
                  <option value="">Communicator নির্বাচন করুন</option>
                  {executives.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
              </CompactField>}
              <CompactField label="Follow-up Date & Time">
                <input type="datetime-local" className="input" value={crmForm.scheduled_at} onChange={(e) => setCrmForm((current) => ({ ...current, scheduled_at: e.target.value }))} />
              </CompactField>
              <CompactField label="Follow-up কেন করবেন / Note"><textarea rows={3} className="input" value={crmForm.note} onChange={(e) => setCrmForm((current) => ({ ...current, note: e.target.value }))} /></CompactField>
              <CompactField label="বর্তমান Follow-up Result" span2><textarea rows={2} className="input" value={crmForm.result} onChange={(e) => setCrmForm((current) => ({ ...current, result: e.target.value }))} /></CompactField>
              {followupError && <div className="text-xs font-semibold text-rose-600 sm:col-span-2">{followupError}</div>}
              <button type="submit" disabled={followupSaving} className="rounded-full bg-gradient-to-r from-violet-500 to-violet-400 py-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-50 sm:col-span-2">
                {followupSaving ? "Saving..." : "Save Follow-up"}
              </button>
            </div>
          </form>
        </div>
      )}
      <LimitReachedModal message={limitNotice} onClose={() => setLimitNotice("")} />

      <style>{`
        .input { width: 100%; border: 1px solid #E2E8F0; border-radius: 10px; padding: 8px 10px; font-size: 12.5px; outline: none; background: #F8FAFC; transition: border-color .15s, box-shadow .15s, background .15s; }
        .input:focus { border-color: #A5B4FC; box-shadow: 0 0 0 3px #EEF2FF; background: #fff; }
        .uinput { width: 100%; border: none; border-bottom: 1px solid transparent; padding: 2px 0 4px; font-size: 13px; font-weight: 600; color: #1E293B; outline: none; background: transparent; transition: border-color .15s; }
        .uinput:hover { border-color: #E2E8F0; }
        .uinput:focus { border-color: #6366F1; }
      `}</style>
    </div>
  );
}

function Card({ title, action, children }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
        <h2 className="text-xs font-black uppercase tracking-wide text-slate-600">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// Underline-style "profile fact" row used inside the Basic Information card
function ProfileRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <label className="w-28 flex-shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function CompactField({ label, children, span2 }) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</label>
      {children}
    </div>
  );
}

// Follow-ups rendered as a connected timeline (dot + line), like an activity stream
function FollowupTimeline({ followups, readOnly, isAdmin, executives, onUpdate }) {
  if (!followups.length) return <div className="py-8 text-center text-xs text-slate-400">কোনো follow-up history নেই।</div>;
  return (
    <div className="relative space-y-4 pl-5">
      <div className="absolute bottom-2 left-[5px] top-2 w-px bg-slate-200" />
      {followups.map((item) => <FollowupTimelineRow key={item.id} item={item} readOnly={readOnly} isAdmin={isAdmin} executives={executives} onUpdate={onUpdate} />)}
    </div>
  );
}

function FollowupTimelineRow({ item, readOnly, isAdmin, executives, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    scheduled_at: item.scheduled_at ? item.scheduled_at.slice(0, 16) : "",
    note: item.note || "",
    result: item.result || "",
    stage: item.stage || "",
    completed: item.completed,
    assigned_to: item.assigned_to || "",
  });

  async function save() {
    await onUpdate(item.id, {
      ...draft,
      scheduled_at: new Date(draft.scheduled_at).toISOString(),
    });
    setEditing(false);
  }

  return (
    <div className="relative">
      <span className={`absolute -left-5 top-1.5 h-3 w-3 rounded-full border-2 border-white shadow ${item.completed ? "bg-emerald-500" : "bg-amber-500"}`} />
      <div className={`rounded-xl border p-3.5 ${item.completed ? "border-emerald-100 bg-emerald-50/50" : "border-amber-100 bg-amber-50/50"}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-1 text-[10px] font-black ${item.completed ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"}`}>
              {item.completed ? "FOLLOWED UP" : "PENDING"}
            </span>
            <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${STAGE_COLORS[item.stage] || "bg-slate-100 text-slate-700"}`}>{item.stage || "No stage"}</span>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-slate-700">{new Date(item.scheduled_at).toLocaleString("en-GB")}</div>
          <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-slate-400">
            {item.assignee_name && <ProfileAvatar name={item.assignee_name} imageUrl={item.assignee_image_url} className="h-5 w-5" fallbackClassName="bg-slate-500" />}
            {item.assignee_name || "Unassigned"} · by {item.creator_name || "Unknown"}
          </div>
            <div className="text-[10px] font-semibold text-blue-600">Set on: {new Date(item.created_at).toLocaleString("en-GB")}</div>
          </div>
        </div>

        {editing ? (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <input type="datetime-local" className="input" value={draft.scheduled_at} onChange={(event) => setDraft((current) => ({ ...current, scheduled_at: event.target.value }))} />
            <select className="input" value={draft.stage} onChange={(event) => setDraft((current) => ({ ...current, stage: event.target.value }))}>
              {STAGE_OPTIONS.map((stage) => <option key={stage} value={stage} style={{ color: STAGE_HEX[stage], fontWeight: 700 }}>● {stage}</option>)}
            </select>
            {isAdmin && (
              <select className="input md:col-span-2" value={draft.assigned_to} onChange={(event) => setDraft((current) => ({ ...current, assigned_to: event.target.value }))}>
                <option value="">Communicator নির্বাচন করুন</option>
                {executives.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            )}
            <textarea className="input md:col-span-2" rows={2} placeholder="Follow-up note" value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} />
            <textarea className="input md:col-span-2" rows={2} placeholder="Follow-up result / data entry" value={draft.result} onChange={(event) => setDraft((current) => ({ ...current, result: event.target.value }))} />
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <input type="checkbox" checked={draft.completed} onChange={(event) => setDraft((current) => ({ ...current, completed: event.target.checked }))} />
              Follow-up সম্পন্ন হয়েছে
            </label>
            <div className="flex justify-end gap-2 md:col-span-2">
              <button onClick={() => setEditing(false)} className="rounded-full border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">Cancel</button>
              <button onClick={save} className="rounded-full bg-gradient-to-r from-violet-500 to-violet-400 px-4 py-2 text-xs font-bold text-white">Save</button>
            </div>
          </div>
        ) : (
          <div className="mt-2.5">
            {item.note && <div className="text-xs text-slate-600"><b>Note:</b> {item.note}</div>}
            {item.result && <div className="mt-1 text-xs text-slate-700"><b>Result:</b> {item.result}</div>}
            {!readOnly && <button onClick={() => setEditing(true)} className="mt-2 rounded-full border border-violet-200 bg-white px-3 py-1.5 text-[11px] font-bold text-violet-700">Follow-up Data Entry / Edit</button>}
          </div>
        )}
      </div>
    </div>
  );
}

function countLeadContexts(entries = []) {
  return new Set(entries.map((entry) => entry.context_id || entry.id)).size;
}

function StandaloneLeadHistoryList({ entries }) {
  const [openId, setOpenId] = useState(null);
  const groups = [...entries.reduce((map, entry) => {
    const contextId = entry.context_id || entry.id;
    if (!map.has(contextId)) map.set(contextId, []);
    map.get(contextId).push(entry);
    return map;
  }, new Map()).entries()];

  return groups.map(([contextId, history]) => {
    const initial = history.find((entry) => entry.kind === "Initial Lead Task") || history[history.length - 1];
    const rawLeadData = initial?.lead_data || {};
    const labels = rawLeadData.manual_field_labels || {};
    const leadData = Object.fromEntries(
      Object.entries(rawLeadData)
        .filter(([key]) => key !== "manual_field_labels")
        .map(([key, value]) => [labels[key] || key, value]),
    );
    const isOpen = openId === contextId;
    const leadName = leadData.Name || leadData.full_name || initial?.project_name || "Standalone Lead";
    return (
      <div key={contextId} className="overflow-hidden rounded-xl border border-indigo-100">
        <button onClick={() => setOpenId(isOpen ? null : contextId)} className="w-full px-3.5 py-3 text-left transition-colors hover:bg-indigo-50/50">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-900">{leadName}</div>
              <div className="mt-0.5 text-[10px] font-semibold text-indigo-600">Manual/Standalone Lead · {history.length} task/follow-up</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400">{initial?.created_at ? new Date(initial.created_at).toLocaleDateString("en-GB") : ""}</span>
              {isOpen ? <ChevronUpIcon className="h-3.5 w-3.5 text-indigo-500" /> : <ChevronDownIcon className="h-3.5 w-3.5 text-indigo-500" />}
            </div>
          </div>
        </button>
        {isOpen && (
          <div className="space-y-3 border-t border-indigo-100 bg-indigo-50/20 px-3.5 py-3.5">
            {Object.keys(leadData).length > 0 && <ArrangedRegistrationData arranged={arrangeDataEntries(leadData)} />}
            <div>
              <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-indigo-600">Admin, Communicator & Follow-up Timeline</div>
              <div className="space-y-2">
                {history.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map((entry) => (
                  <ReadOnlyTaskHistoryCard key={entry.id} entry={entry} includeLeadData={false} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  });
}

function RegistrationHistoryList({ registrations }) {
  const [openId, setOpenId] = useState(null);

  return (
    <div className="flex flex-col gap-2.5">
      {registrations.map((r) => {
        const isOpen = openId === r.registration_id;
        const arranged = arrangeDataEntries(Object.fromEntries(
          Object.entries(r.data || {}).map(([key, value]) => [r.field_labels?.[key] || key, value]),
        ));
        return (
          <div key={r.registration_id} className="overflow-hidden rounded-xl border border-slate-100">
            <button
              onClick={() => setOpenId(isOpen ? null : r.registration_id)}
              className="w-full px-3.5 py-3 text-left transition-colors hover:bg-slate-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">{r.project_name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">{new Date(r.created_at).toLocaleDateString("en-GB")}</span>
                  {isOpen ? <ChevronUpIcon className="h-3.5 w-3.5 text-emerald-500" /> : <ChevronDownIcon className="h-3.5 w-3.5 text-emerald-500" />}
                </div>
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-emerald-600">{r.reg_id}</div>
            </button>

            {isOpen && (
              <div className="border-t border-slate-100 bg-emerald-50/30 px-3.5 py-3.5">
                <div className="mb-2.5 flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-400 px-3 py-2.5 text-white">
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-bold">Registration Successful</span>
                </div>
                <ArrangedRegistrationData arranged={arranged} />
                {r.task_history?.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-wide text-indigo-600">Communicator Task & Follow-up Data</div>
                    {r.task_history.map((entry) => <ReadOnlyTaskHistoryCard key={entry.id} entry={entry} />)}
                  </div>
                )}
                <button onClick={() => setOpenId(null)} className="mt-2.5 w-full rounded-full border border-slate-200 py-1.5 text-[10px] font-semibold text-slate-500 transition-colors hover:bg-slate-100">
                  Hide
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ArrangedRegistrationData({ arranged }) {
  return (
    <div className="space-y-3">
      <RegistrationDataGroup title="Basic Personal Information" entries={arranged.personal} />
      <RegistrationDataGroup title="Follow-up Information" entries={arranged.followup} />
      <RegistrationDataGroup title="Other Information" entries={arranged.other} />
    </div>
  );
}

function RegistrationDataGroup({ title, entries }) {
  if (!entries.length) return null;
  return (
    <div>
      <div className="mb-1.5 text-[9px] font-black uppercase tracking-wide text-slate-400">{title}</div>
      <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
        {entries.map(([key, value]) => (
          <div key={key} className="rounded-lg bg-white px-2.5 py-2">
            <div className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">{key.replace(/_/g, " ")}</div>
            <div className="mt-0.5 break-words text-[11px] font-semibold text-slate-700">{typeof value === "object" ? JSON.stringify(value) : String(value || "—")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReadOnlyTaskHistoryCard({ entry, includeLeadData = true }) {
  const leadData = Object.fromEntries(
    Object.entries(entry.lead_data || {}).filter(([key]) => key !== "manual_field_labels"),
  );
  const values = {
    ...(includeLeadData ? leadData : {}),
    Stage: entry.stage,
    "Remarks / Problem": entry.customer_problem,
    "Communicator Remarks": entry.executive_remarks,
    "Follow-up Date": entry.next_following_date || entry.due_date,
    "Follow-up Reason": entry.followup_reason,
    ...(entry.extra_data || {}),
  };
  const arranged = arrangeDataEntries(values);
  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-2.5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="rounded-full bg-indigo-600 px-2 py-1 text-[9px] font-black text-white">{entry.kind}</span>
          <span className={`ml-2 rounded-full px-2 py-1 text-[9px] font-bold ${entry.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{entry.status}</span>
          {entry.project_name && <span className="ml-2 text-[10px] font-bold text-indigo-700">{entry.project_name}</span>}
          <div className="mt-1 text-[10px] font-bold text-slate-600">Communicator: {entry.consultant || "Unassigned"} · Created by: {entry.created_by_name || "Unknown"}</div>
        </div>
        <span className="text-[9px] font-semibold text-slate-400">
          {entry.completed_at ? "Completed" : "Created"}: {new Date(entry.completed_at || entry.created_at).toLocaleString("en-GB")}
        </span>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
        {[...arranged.personal, ...arranged.followup, ...arranged.other].map(([key, value]) => (
          <div key={key} className="rounded-lg bg-white px-2.5 py-2">
            <div className="text-[8px] font-bold uppercase tracking-wide text-slate-400">{key.replace(/_/g, " ")}</div>
            <div className="mt-0.5 break-words text-[10px] font-semibold text-slate-700">{key.toLowerCase().includes("date") ? new Date(value).toLocaleString("en-GB") : typeof value === "object" ? JSON.stringify(value) : String(value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}