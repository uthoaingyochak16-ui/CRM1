import { Fragment, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getMyTodos, updateTask, listTasks, listUsers, bulkAssignTasks } from "../../api/guest.js";
import LimitReachedModal from "../../components/LimitReachedModal.jsx";
import { useRealtimeRefresh } from "../../realtime/realtimeHooks.js";
import ProfileAvatar from "../../components/ProfileAvatar.jsx";
import ListScrollArea from "../../components/ListScrollArea.jsx";

const STAGE_OPTIONS = [
  "Interested", "Dropped", "Counselling", "Associate",
  "Course Acc", "Potential Batch", "QG", "Quantier",
  "QPM", "Ardentiar", "Organier", "Foreigner",
];
const STAGE_HEX = {
  Interested: "#0369a1", Dropped: "#be123c", Counselling: "#b45309", Associate: "#6d28d9",
  "Course Acc": "#4338ca", "Potential Batch": "#0f766e", QG: "#047857", Quantier: "#15803d",
  QPM: "#a21caf", Ardentiar: "#c2410c", Organier: "#0e7490", Foreigner: "#4d7c0f",
};

export default function TodoPage({ currentUser, onLoggedOut }) {
  const isAdmin = currentUser?.role === "admin";
  return isAdmin
    ? <AdminConsultantTodoView onLoggedOut={onLoggedOut} />
    : <ExecutiveTodoTableView currentUser={currentUser} onLoggedOut={onLoggedOut} />;
}

function localDateValue(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function taskEffectiveDate(task) {
  const value = task.next_following_date || task.due_date || task.created_at;
  return value ? localDateValue(new Date(value)) : "";
}

function AdminConsultantTodoView({ onLoggedOut }) {
  const [executives, setExecutives] = useState([]);
  const [selectedExecutive, setSelectedExecutive] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listUsers()
      .then((response) => {
        setExecutives((response.data || []).filter((user) => user.role === "executive"));
      })
      .catch((error) => {
        if (error.response?.status === 401) onLoggedOut();
      })
      .finally(() => setLoading(false));
  }, [onLoggedOut]);
  useRealtimeRefresh(["users", "project_permissions"], () => {
    listUsers().then((response) => {
      setExecutives((response.data || []).filter((user) => user.role === "executive"));
    });
  });

  if (selectedExecutive) {
    return (
      <ExecutiveTodoTableView
        targetUserId={selectedExecutive.id}
        consultantName={selectedExecutive.name}
        readOnly
        onBack={() => setSelectedExecutive(null)}
        onLoggedOut={onLoggedOut}
      />
    );
  }

  return (
    <div className="w-full max-w-none px-2 py-3">
      <div className="mb-4">
        <h1 className="font-display text-xl font-black text-[#101828]">Communicator To-do</h1>
        <p className="mt-0.5 text-xs text-[#667085]">à¦•à§‹à¦¨à§‹ communicator à¦¨à¦¿à¦°à§à¦¬à¦¾à¦šà¦¨ à¦•à¦°à§‡ à¦¤à¦¾à¦° To-do list à¦“ history à¦¦à§‡à¦–à§à¦¨à¥¤</p>
      </div>
      {loading && <div className="py-10 text-center text-sm text-[#667085]">à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡â€¦</div>}
      {!loading && executives.length === 0 && <div className="rounded-xl border border-[#E4E7EC] bg-white py-14 text-center text-sm text-[#98A2B3]">à¦•à§‹à¦¨à§‹ communicator à¦¨à§‡à¦‡à¥¤</div>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {executives.map((executive) => (
          <button
            key={executive.id}
            type="button"
            onClick={() => setSelectedExecutive(executive)}
            className="flex items-center gap-3 rounded-xl border border-[#DCE4F2] bg-white p-4 text-left shadow-sm transition hover:border-[#2554C7] hover:bg-[#F5F8FF]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EEF4FF] text-sm font-black text-[#2554C7]">
              {executive.name?.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-[#101828]">{executive.name}</span>
              <span className="block truncate text-[11px] text-[#667085]">{executive.email}</span>
            </span>
            <span className="text-[#2554C7]">â†’</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ExecutiveTodoTableView({ onLoggedOut, targetUserId = null, consultantName = "", readOnly = false, onBack = null }) {
  const navigate = useNavigate();
  const todayValue = localDateValue();
  const previousDate = new Date();
  previousDate.setDate(previousDate.getDate() - 1);
  const previousDateValue = localDateValue(previousDate);
  const [selectedDate, setSelectedDate] = useState(todayValue);
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openFormFor, setOpenFormFor] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    getMyTodos(selectedDate, targetUserId)
      .then((response) => setTodos(response.data))
      .catch((error) => {
        if (error.response?.status === 401) onLoggedOut();
      })
      .finally(() => setLoading(false));
  }, [selectedDate, targetUserId, onLoggedOut]);

  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(["tasks", "customers", "registrations"], load);

  const carryOverCount = todos.filter(
    (task) => task.status !== "completed" && taskEffectiveDate(task) < todayValue && selectedDate === todayValue
  ).length;
  const completedCount = todos.filter((task) => task.status === "completed").length;
  const pendingCount = todos.length - completedCount;

  return (
    <div className="w-full max-w-none px-2 py-3">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          {onBack && <button onClick={onBack} className="back-button mb-2">â† à¦¸à¦¬ Communicator</button>}
          <h1 className="font-display text-xl font-black text-[#101828]">{consultantName ? `${consultantName} â€” To-do` : "à¦†à¦œà¦•à§‡à¦° To-do"}</h1>
          <p className="mt-0.5 text-xs text-[#667085]">
            {readOnly ? "Read-only view Â· Filter à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦° à¦•à¦°à§‡ task history à¦¦à§‡à¦–à§à¦¨" : "à¦†à¦œà¦•à§‡à¦° task à¦à¦¬à¦‚ à¦†à¦—à§‡à¦° à¦¦à¦¿à¦¨à§‡à¦° à¦…à¦¸à¦®à§à¦ªà§‚à¦°à§à¦£ carry-over task"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5 text-[10px] font-bold">
            <span className="rounded-md bg-blue-100 px-2 py-1 text-blue-800">Pending {pendingCount}</span>
            <span className="rounded-md bg-emerald-100 px-2 py-1 text-emerald-800">Completed {completedCount}</span>
            {carryOverCount > 0 && <span className="rounded-md bg-rose-100 px-2 py-1 text-rose-800">Carry-over {carryOverCount}</span>}
          </div>
          <input
            type="date"
            max={todayValue}
            value={selectedDate}
            onChange={(event) => {
              setSelectedDate(event.target.value);
              setOpenFormFor(null);
            }}
            className="w-[145px] rounded-lg border border-[#D0D5DD] bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#2554C7] focus:ring-2 focus:ring-[#EEF4FF]"
          />
          {selectedDate !== todayValue && (
            <button onClick={() => setSelectedDate(todayValue)} className="rounded-lg border border-[#D0D5DD] px-3 py-1.5 text-xs font-semibold text-[#667085] hover:bg-[#F9FAFB]">
              Today
            </button>
          )}
        </div>
      </div>

      <div className="mb-3 flex w-fit gap-1 rounded-xl bg-[#EAECF0] p-1">
        <button
          type="button"
          onClick={() => { setSelectedDate(todayValue); setOpenFormFor(null); }}
          className={`rounded-lg px-4 py-1.5 text-xs font-bold ${selectedDate === todayValue ? "bg-white text-[#17368F] shadow-sm" : "text-[#667085]"}`}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => { setSelectedDate(previousDateValue); setOpenFormFor(null); }}
          className={`rounded-lg px-4 py-1.5 text-xs font-bold ${selectedDate === previousDateValue ? "bg-white text-[#17368F] shadow-sm" : "text-[#667085]"}`}
        >
          Previous Day
        </button>
      </div>

      {loading && <div className="py-10 text-center text-sm text-[#667085]">à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡â€¦</div>}
      {!loading && todos.length === 0 && (
        <div className="rounded-xl border border-[#E4E7EC] bg-white py-14 text-center text-sm text-[#98A2B3]">
          à¦à¦‡ à¦¤à¦¾à¦°à¦¿à¦–à§‡ à¦•à§‹à¦¨à§‹ task à¦¨à§‡à¦‡à¥¤
        </div>
      )}

      {!loading && todos.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[#DDE3EA] bg-white shadow-sm">
          <ListScrollArea>
            <table className="w-full min-w-0 table-fixed border-collapse text-left">
              <thead>
                <tr className="border-b border-[#DDE3EA] bg-[#F2F4F7]">
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase text-[#475467]">Task / Guest</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase text-[#475467]">Type</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase text-[#475467]">Scheduled</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase text-[#475467]">Program</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase text-[#475467]">Stage</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase text-[#475467]">Status</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase text-[#475467]">Action</th>
                </tr>
              </thead>
              <tbody>
                {todos.map((task, index) => {
                  const effectiveDate = taskEffectiveDate(task);
                  const isCarryOver = selectedDate === todayValue && task.status !== "completed" && effectiveDate < todayValue;
                  const isCompleted = task.status === "completed";
                  const rowColor = isCarryOver
                    ? "border-l-4 border-l-rose-500 bg-rose-50/90 hover:bg-rose-100/80"
                    : isCompleted
                      ? "border-l-4 border-l-emerald-500 bg-emerald-50/80 hover:bg-emerald-100/70"
                      : index % 2 === 0
                        ? "border-l-4 border-l-blue-500 bg-blue-50/80 hover:bg-blue-100/70"
                        : "border-l-4 border-l-violet-500 bg-violet-50/70 hover:bg-violet-100/70";
                  return (
                    <Fragment key={task.id}>
                      <tr className={`border-b border-white transition-colors ${rowColor}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <ProfileAvatar name={task.customer_name || task.title} imageUrl={task.customer_image_url} />
                            <div><div className={`max-w-[220px] truncate text-sm font-bold ${isCompleted ? "text-[#667085] line-through" : "text-[#101828]"}`}>{task.customer_name || task.title}</div>
                            {task.description && <div className="mt-0.5 max-w-[220px] truncate text-[10px] text-[#667085]">{task.description}</div>}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-[#475467]">{task.customer_id ? "Follow-up" : "General"}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-[#475467]">
                          {effectiveDate ? new Date(`${effectiveDate}T00:00:00`).toLocaleDateString("en-GB") : "â€”"}
                          {isCarryOver && <span className="ml-2 rounded-md bg-rose-600 px-1.5 py-0.5 text-[9px] font-bold text-white">CARRY-OVER</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#475467]">{task.project_name || "â€”"}</td>
                        <td className="px-4 py-3 text-xs text-[#475467]">{task.stage || "â€”"}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${isCompleted ? "bg-emerald-100 text-emerald-800" : isCarryOver ? "bg-rose-100 text-rose-800" : "bg-blue-100 text-blue-800"}`}>
                            {isCompleted ? "Completed" : isCarryOver ? "Overdue" : "Pending"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            {task.customer_id && (
                              <button onClick={() => navigate(`/admin/customers/${task.customer_id}`)} className="rounded-md bg-white/80 px-2.5 py-1.5 text-[11px] font-bold text-[#17368F] ring-1 ring-[#B2CCFF] hover:bg-white">
                                Profile
                              </button>
                            )}
                            {task.customer_id && !isCompleted && !readOnly && (
                              <button onClick={() => setOpenFormFor(openFormFor === task.id ? null : task.id)} className="rounded-md bg-[#2554C7] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#17368F]">
                                {openFormFor === task.id ? "Close" : "Follow-up"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {openFormFor === task.id && (
                        <tr key={`${task.id}-form`} className="border-b border-[#DDE3EA] bg-[#F8FAFC]">
                          <td colSpan={7} className="p-3">
                            <FollowUpMini task={task} onDone={() => { setOpenFormFor(null); load(); }} />
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
    </div>
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   EXECUTIVE VIEW â€” à¦¨à¦¿à¦œà§‡à¦° assigned pending tasks
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
// oxlint-disable no-unused-vars
function ExecutiveTodoView({ currentUser, onLoggedOut }) {
  const navigate = useNavigate();
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openFormFor, setOpenFormFor] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    getMyTodos()
      .then((r) => setTodos(r.data))
      .catch((err) => { if (err.response?.status === 401) onLoggedOut(); })
      .finally(() => setLoading(false));
  }, [onLoggedOut]);

  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(["tasks", "customers", "registrations"], load);

  async function markDone(task) {
    await updateTask(task.id, { status: "completed" });
    setTodos((list) => list.filter((t) => t.id !== task.id));
  }

  const today = new Date().toLocaleDateString("bn-BD", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const followups = todos.filter((t) => t.customer_id);
  const general = todos.filter((t) => !t.customer_id);

  return (
    <div className="mx-auto max-w-3xl px-3 py-3">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-xl font-black text-[#101828]">To-do</h1>
        <p className="mt-1 text-xs text-[#667085]">{today}</p>
      </div>

      {loading && <div className="py-10 text-center text-sm text-[#667085]">à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡â€¦</div>}

      {!loading && todos.length === 0 && (
        <div className="rounded-xl border border-[#E4E7EC] bg-white py-16 text-center">
          <div className="text-3xl">âœ…</div>
          <div className="mt-2 text-sm font-semibold text-[#027A48]">à¦†à¦œà¦•à§‡à¦° à¦¸à¦¬ à¦•à¦¾à¦œ à¦¸à¦®à§à¦ªà¦¨à§à¦¨!</div>
          <div className="mt-1 text-xs text-[#98A2B3]">à¦•à§‹à¦¨à§‹ pending task à¦¬à¦¾ follow-up à¦¨à§‡à¦‡à¥¤</div>
        </div>
      )}

      {/* Follow-up tasks */}
      {followups.length > 0 && (
        <section className="mb-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-base">ðŸ“ž</span>
            <h2 className="text-sm font-bold text-[#101828]">à¦†à¦œà¦•à§‡à¦° Follow-up</h2>
            <span className="rounded-full bg-[#FEF3F2] px-2 py-0.5 text-[10px] font-bold text-[#D92D20]">
              {followups.length}à¦Ÿà¦¿
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {followups.map((t) => (
              <div key={t.id} className="rounded-xl border border-[#FECACA] bg-[#FFF5F5] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <ProfileAvatar name={t.customer_name || t.title} imageUrl={t.customer_image_url} />
                      <span className="text-sm font-bold text-[#101828]">
                        {t.customer_name || t.title}
                      </span>
                      {t.stage && (
                        <span className="rounded-full bg-[#EEF4FF] px-2 py-0.5 text-[10px] font-bold text-[#17368F]">
                          {t.stage}
                        </span>
                      )}
                    </div>
                    {t.project_name && (
                      <div className="mt-0.5 text-xs text-[#667085]">{t.project_name}</div>
                    )}
                    {t.customer_problem && (
                      <div className="mt-1 text-xs text-[#344054]">à¦¸à¦®à¦¸à§à¦¯à¦¾: {t.customer_problem}</div>
                    )}
                    {t.executive_remarks && (
                      <div className="mt-0.5 text-xs text-[#667085]">à¦†à¦—à§‡à¦° à¦°à¦¿à¦®à¦¾à¦°à§à¦•: {t.executive_remarks}</div>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 flex-col gap-1.5">
                    <button
                      onClick={() => navigate(`/admin/customers/${t.customer_id}`)}
                      className="rounded-full bg-[#EEF4FF] px-3 py-1.5 text-xs font-bold text-[#17368F] hover:bg-[#DBEAFE]"
                    >
                      Profile â†’
                    </button>
                    <button
                      onClick={() => setOpenFormFor(openFormFor === t.id ? null : t.id)}
                      className="rounded-full bg-[#2554C7] px-3 py-1.5 text-xs font-bold text-white"
                    >
                      {openFormFor === t.id ? "à¦¬à¦¨à§à¦§ à¦•à¦°à§à¦¨" : "Follow-up à¦¦à¦¿à¦¨"}
                    </button>
                  </div>
                </div>

                {openFormFor === t.id && (
                  <FollowUpMini
                    task={t}
                    onDone={() => {
                      setTodos((list) => list.filter((x) => x.id !== t.id));
                      setOpenFormFor(null);
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* General tasks */}
      {general.length > 0 && (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-base">ðŸ“‹</span>
            <h2 className="text-sm font-bold text-[#101828]">à¦¸à¦¾à¦§à¦¾à¦°à¦£ Task</h2>
            <span className="rounded-full bg-[#EEF4FF] px-2 py-0.5 text-[10px] font-bold text-[#17368F]">
              {general.length}à¦Ÿà¦¿
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {general.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-xl border border-[#E4E7EC] bg-white p-4">
                <input
                  type="checkbox"
                  className="h-4 w-4 flex-shrink-0 cursor-pointer accent-[#2554C7]"
                  onChange={() => markDone(t)}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-[#101828]">{t.title}</div>
                  {t.description && (
                    <div className="text-xs text-[#667085]">{t.description}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   ADMIN VIEW â€” à¦¸à¦¬ unassigned à¦“ pending tasks
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
// oxlint-enable no-unused-vars
// oxlint-disable no-unused-vars
function AdminTodoView({ currentUser, onLoggedOut }) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [executives, setExecutives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState(null);
  const [selectedExec, setSelectedExec] = useState({});

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      listTasks({ status: "pending" }),
      listUsers(),
    ])
      .then(([tasksRes, usersRes]) => {
        setTasks(tasksRes.data);
        setExecutives((usersRes.data || []).filter((u) => u.role === "executive" && u.is_active));
      })
      .catch((err) => { if (err.response?.status === 401) onLoggedOut(); })
      .finally(() => setLoading(false));
  }, [onLoggedOut]);

  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(["tasks", "customers", "registrations", "users"], load);

  async function assignTask(taskId) {
    const execId = selectedExec[taskId];
    if (!execId) return;
    setAssigningId(taskId);
    try {
      await bulkAssignTasks([taskId], execId);
      load();
    } finally {
      setAssigningId(null);
    }
  }

  const unassigned = tasks.filter((t) => !t.assigned_to);
  const assigned = tasks.filter((t) => t.assigned_to);

  const today = new Date().toLocaleDateString("bn-BD", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="mx-auto max-w-4xl px-3 py-3">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-black text-[#101828]">ðŸ“‹ Task Overview</h1>
          <p className="mt-1 text-xs text-[#667085]">{today}</p>
        </div>
        <div className="flex gap-2 text-xs font-semibold">
          <span className="rounded-full bg-[#FEF3F2] px-3 py-1 text-[#D92D20]">
            {unassigned.length} Unassigned
          </span>
          <span className="rounded-full bg-[#EEF4FF] px-3 py-1 text-[#17368F]">
            {assigned.length} Assigned
          </span>
        </div>
      </div>

      {loading && <div className="py-10 text-center text-sm text-[#667085]">à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡â€¦</div>}

      {!loading && tasks.length === 0 && (
        <div className="rounded-xl border border-[#E4E7EC] bg-white py-16 text-center">
          <div className="text-3xl">âœ…</div>
          <div className="mt-2 text-sm font-semibold text-[#027A48]">à¦•à§‹à¦¨à§‹ pending task à¦¨à§‡à¦‡!</div>
        </div>
      )}

      {/* Unassigned tasks */}
      {unassigned.length > 0 && (
        <section className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-base">ðŸ”´</span>
            <h2 className="text-sm font-bold text-[#101828]">Unassigned Tasks</h2>
            <span className="rounded-full bg-[#FEF3F2] px-2 py-0.5 text-[10px] font-bold text-[#D92D20]">
              {unassigned.length}à¦Ÿà¦¿
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {unassigned.map((t) => (
              <div key={t.id} className="rounded-xl border border-[#FECACA] bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <ProfileAvatar name={t.customer_name || t.title} imageUrl={t.customer_image_url} />
                      <span className="text-sm font-bold text-[#101828]">
                        {t.customer_name || t.title}
                      </span>
                      {t.customer_id && (
                        <span className="rounded-full bg-[#F0FDF4] px-2 py-0.5 text-[10px] font-bold text-[#027A48]">
                          Lead
                        </span>
                      )}
                    </div>
                    {t.project_name && (
                      <div className="mt-0.5 text-xs text-[#667085]">ðŸ—‚ {t.project_name}</div>
                    )}
                    {t.description && (
                      <div className="mt-0.5 text-xs text-[#98A2B3]">{t.description}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {t.customer_id && (
                      <button
                        onClick={() => navigate(`/admin/customers/${t.customer_id}`)}
                        className="rounded-full bg-[#EEF4FF] px-3 py-1.5 text-xs font-bold text-[#17368F] hover:bg-[#DBEAFE] whitespace-nowrap"
                      >
                        Profile â†’
                      </button>
                    )}
                    {executives.length > 0 ? (
                      <div className="flex items-center gap-1.5">
                        <select
                          value={selectedExec[t.id] || ""}
                          onChange={(e) => setSelectedExec((prev) => ({ ...prev, [t.id]: e.target.value }))}
                          className="rounded-lg border border-[#D0D5DD] px-2 py-1.5 text-xs outline-none focus:border-[#2554C7]"
                        >
                          <option value="">Communicator à¦¬à§‡à¦›à§‡ à¦¨à¦¿à¦¨</option>
                          {executives.map((e) => (
                            <option key={e.id} value={e.id}>{e.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => assignTask(t.id)}
                          disabled={!selectedExec[t.id] || assigningId === t.id}
                          className="rounded-full bg-[#2554C7] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50 whitespace-nowrap"
                        >
                          {assigningId === t.id ? "..." : "Assign"}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-[#98A2B3]">à¦•à§‹à¦¨à§‹ communicator à¦¨à§‡à¦‡</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Assigned tasks */}
      {assigned.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-base">ðŸŸ¡</span>
            <h2 className="text-sm font-bold text-[#101828]">Assigned Pending Tasks</h2>
            <span className="rounded-full bg-[#EEF4FF] px-2 py-0.5 text-[10px] font-bold text-[#17368F]">
              {assigned.length}à¦Ÿà¦¿
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {assigned.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-xl border border-[#E4E7EC] bg-white p-4">
                <ProfileAvatar name={t.customer_name || t.title} imageUrl={t.customer_image_url} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-[#101828]">
                      {t.customer_name || t.title}
                    </span>
                    {t.stage && (
                      <span className="rounded-full bg-[#EEF4FF] px-2 py-0.5 text-[10px] font-bold text-[#17368F]">
                        {t.stage}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex gap-3 text-xs text-[#667085]">
                    {t.assignee_name && <span className="flex items-center gap-1"><ProfileAvatar name={t.assignee_name} imageUrl={t.assignee_image_url} className="h-5 w-5" fallbackClassName="bg-slate-500" />{t.assignee_name}</span>}
                    {t.project_name && <span>ðŸ—‚ {t.project_name}</span>}
                  </div>
                </div>
                {t.customer_id && (
                  <button
                    onClick={() => navigate(`/admin/customers/${t.customer_id}`)}
                    className="rounded-full bg-[#EEF4FF] px-3 py-1.5 text-xs font-bold text-[#17368F] hover:bg-[#DBEAFE] whitespace-nowrap"
                  >
                    Profile â†’
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   FOLLOW-UP MINI FORM (Executive only)
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function FollowUpMini({ task, onDone }) {
  const [form, setForm] = useState({
    stage: task.stage || "",
    next_following_date: "",
    next_followup_note: "",
    status: "pending",
    call_received: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [limitNotice, setLimitNotice] = useState("");

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
    setError("");
  }

  async function handleSubmit(complete) {
    if (complete && (!form.stage || form.call_received === "")) {
      setError("Task complete à¦•à¦°à¦¤à§‡ Stage à¦à¦¬à¦‚ Phone Receive Status à¦ªà§‚à¦°à¦£ à¦•à¦°à§à¦¨à¥¤");
      return;
    }
    if (form.next_following_date && !form.next_followup_note.trim()) {
      setError("à¦ªà¦°à¦¬à¦°à§à¦¤à§€ Follow-up date à¦¦à¦¿à¦²à§‡ à¦•à§‡à¦¨ Follow-up à¦•à¦°à¦¬à§‡à¦¨ à¦¸à§‡à¦‡ note à¦²à¦¿à¦–à§à¦¨à¥¤");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateTask(task.id, {
        stage: form.stage,
        next_following_date: form.next_following_date
          ? new Date(form.next_following_date).toISOString()
          : null,
        followup_reason: form.next_followup_note,
        ...(complete ? { call_received: form.call_received === "received" } : {}),
        status: complete ? "completed" : "pending",
      });
      onDone();
    } catch (requestError) {
      const detail = requestError.response?.data?.detail || "Follow-up à¦¸à¦‚à¦°à¦•à§à¦·à¦£ à¦•à¦°à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤";
      if (/limit|à¦ªà§‚à¦°à§à¦£ à¦¹à¦¯à¦¼à§‡à¦›à§‡/i.test(detail)) setLimitNotice(detail);
      else setError(detail);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg border border-[#E4E7EC] bg-white p-3">
      <LimitReachedModal message={limitNotice} onClose={() => setLimitNotice("")} />
      <div>
        <label className="mb-1 block text-[11px] font-bold uppercase text-[#667085]">Stage</label>
        <select
          className="input w-full"
          value={form.stage}
          onChange={(e) => set("stage", e.target.value)}
        >
          <option value="">à¦¨à¦¿à¦°à§à¦¬à¦¾à¦šà¦¨ à¦•à¦°à§à¦¨</option>
          {STAGE_OPTIONS.map((s) => <option key={s} value={s} style={{ color: STAGE_HEX[s], fontWeight: 700 }}>â— {s}</option>)}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-[11px] font-bold uppercase text-[#667085]">
          Phone Receive Status
        </label>
        <select
          className="input w-full"
          value={form.call_received}
          onChange={(e) => set("call_received", e.target.value)}
        >
          <option value="">à¦¨à¦¿à¦°à§à¦¬à¦¾à¦šà¦¨ à¦•à¦°à§à¦¨</option>
          <option value="received">Phone Received</option>
          <option value="not_received">Phone Not Received</option>
        </select>
      </div>
      <div className="col-span-2 grid gap-3 sm:grid-cols-2">
        <div>
        <label className="mb-1 block text-[11px] font-bold uppercase text-[#667085]">
          à¦ªà¦°à¦¬à¦°à§à¦¤à§€ Follow-up
        </label>
        <input
          type="datetime-local"
          className="input w-full"
          value={form.next_following_date}
          onChange={(e) => set("next_following_date", e.target.value)}
        />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase text-[#667085]">Follow-up Note / à¦•à§‡à¦¨ à¦†à¦¬à¦¾à¦° Follow-up à¦•à¦°à¦¬à§‡à¦¨</label>
          <textarea required={Boolean(form.next_following_date)} rows={1} className="input w-full" placeholder="Follow-up à¦•à¦°à¦¾à¦° à¦•à¦¾à¦°à¦£ à¦²à¦¿à¦–à§à¦¨" value={form.next_followup_note} onChange={(e) => set("next_followup_note", e.target.value)} />
        </div>
      </div>
      <div className="col-span-2 flex gap-2">
        <button
          onClick={() => handleSubmit(false)}
          disabled={saving}
          className="flex-1 rounded-full border border-[#2554C7] py-2 text-xs font-bold text-[#2554C7] hover:bg-[#EEF4FF]"
        >
          Save & Keep Pending
        </button>
        <button
          onClick={() => handleSubmit(true)}
          disabled={saving}
          className="flex-1 rounded-full bg-[#027A48] py-2 text-xs font-bold text-white"
        >
          {saving ? "Savingâ€¦" : "Complete à¦•à¦°à§à¦¨"}
        </button>
      </div>
      {error && (
        <div className="col-span-2 rounded-md bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}
      <style>{`.input{border:1px solid #E4E7EC;border-radius:8px;padding:8px 11px;font-size:13px;outline:none}.input:focus{border-color:#2554C7;box-shadow:0 0 0 3px #EEF4FF}`}</style>
    </div>
  );
}
