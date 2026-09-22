import { useEffect, useState } from "react";
import { createReport, getMyReports, getReportPrefill, listAllReports, listUsers } from "../../api/guest.js";
import guest from "../../api/guest.js";
import { useRealtimeRefresh } from "../../realtime/realtimeHooks.js";
import ListScrollArea from "../../components/ListScrollArea.jsx";
import PeriodRangeFilter from "../../components/PeriodRangeFilter.jsx";
import {
  ArrowLeftIcon, InfoIcon, PhoneIcon, HistoryIcon, ClipboardIcon, PlusIcon, LoaderIcon,
} from "../../components/Icons.jsx";

const submitFeedback = (reportId, feedback) =>
  guest.patch(`/api/reports/${reportId}/feedback`, { admin_feedback: feedback });

export default function ReportsPage({ currentUser, onLoggedOut }) {
  const isAdmin = currentUser?.role === "admin";
  return isAdmin
    ? <AdminReports onLoggedOut={onLoggedOut} />
    : <ExecutiveReports currentUser={currentUser} onLoggedOut={onLoggedOut} />;
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   EXECUTIVE VIEW
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function ExecutiveReports({ currentUser, onLoggedOut }) {
  const [view, setView] = useState("list"); // list | form | detail
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("report"); // report | feedback
  const [filterRange, setFilterRange] = useState({ dateFrom: "", dateTo: "" });

  useEffect(() => {
    let mounted = true;
    getMyReports()
      .then((r) => { if (mounted) setReports(r.data); })
      .catch((err) => {
        if (err.response?.status === 401) {
          if (typeof onLoggedOut === "function") onLoggedOut();
        }
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [onLoggedOut]);

  useRealtimeRefresh(["reports", "report_feedbacks"], () => {
    getMyReports().then((r) => {
      setReports(r.data);
      setSelected((current) => (
        current ? r.data.find((item) => item.id === current.id) || current : current
      ));
    }).catch((err) => {
      if (err.response?.status === 401) {
        if (typeof onLoggedOut === "function") onLoggedOut();
      }
    });
  });

  function openDetail(r) { setSelected(r); setActiveTab("report"); setView("detail"); }

  const filteredReports = reports.filter((report) =>
    (!filterRange.dateFrom || report.report_date?.slice(0, 10) >= filterRange.dateFrom) &&
    (!filterRange.dateTo || report.report_date?.slice(0, 10) <= filterRange.dateTo)
  );

  if (view === "form") return (
    <SubmitForm currentUser={currentUser} onLoggedOut={onLoggedOut}
      onSuccess={(r) => { setReports((p) => [r, ...p]); setView("list"); }}
      onCancel={() => setView("list")} />
  );

  if (view === "detail" && selected) return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <button onClick={() => setView("list")} className="back-button mb-4">
        <ArrowLeftIcon className="h-3.5 w-3.5" /> Back
      </button>
      {/* Sub tabs */}
      <div className="mb-5 inline-flex gap-1 rounded-full bg-slate-100 p-1">
        {[["report", "Report"], ["feedback", "Feedback"]].map(([k, l]) => (
          <button key={k} onClick={() => setActiveTab(k)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all ${activeTab === k ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            {l}
            {k === "feedback" && selected.admin_feedback && <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] text-white">1</span>}
          </button>
        ))}
      </div>
      {activeTab === "report" ? <ReportCard r={selected} /> : (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {selected.admin_feedback
            ? <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3">
                <div className="mb-1 text-[10px] font-bold text-amber-700">Admin Feedback</div>
                <div className="text-sm text-slate-700">{selected.admin_feedback}</div>
              </div>
            : <div className="py-10 text-center text-sm text-slate-400">à¦à¦–à¦¨à§‹ à¦•à§‹à¦¨à§‹ feedback à¦¨à§‡à¦‡à¥¤</div>}
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full max-w-none px-2 py-6 sm:px-3">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900"> Reports</h1>
          <p className="mt-0.5 text-xs text-slate-500">à¦œà¦®à¦¾ à¦¦à§‡à¦“à¦¯à¦¼à¦¾ à¦¸à¦¬ report à¦à¦° à¦¤à¦¾à¦²à¦¿à¦•à¦¾à¥¤</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <PeriodRangeFilter onChange={setFilterRange} />
          <button onClick={() => setView("form")}
            className="flex items-center gap-1 rounded-full bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500">
            <PlusIcon className="h-3.5 w-3.5" /> à¦¨à¦¤à§à¦¨ Report
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-14 text-sm font-semibold text-slate-500">
          <LoaderIcon className="h-4 w-4 animate-spin text-indigo-600" /> à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡â€¦
        </div>
      )}
      {!loading && reports.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-400 shadow-sm">
          à¦•à§‹à¦¨à§‹ report à¦¨à§‡à¦‡à¥¤ à¦¨à¦¤à§à¦¨ report à¦œà¦®à¦¾ à¦¦à¦¿à¦¨à¥¤
        </div>
      )}
      {!loading && reports.length > 0 && filteredReports.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-400 shadow-sm">
          à¦¨à¦¿à¦°à§à¦¬à¦¾à¦šà¦¿à¦¤ à¦¤à¦¾à¦°à¦¿à¦–à§‡ à¦•à§‹à¦¨à§‹ report à¦¨à§‡à¦‡à¥¤
        </div>
      )}

      {!loading && filteredReports.length > 0 && (
        <ReportTable
          reports={filteredReports}
          mode="executive"
          onOpen={openDetail}
        />
      )}
      <style>{`
        .input { border: 1px solid #E2E8F0; border-radius: 10px; padding: 8px 11px; font-size: 12.5px; outline: none; background: #F8FAFC; transition: border-color .15s, box-shadow .15s, background .15s; }
        .input:focus { border-color: #A5B4FC; box-shadow: 0 0 0 3px #EEF2FF; background: #fff; }
      `}</style>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ADMIN VIEW
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function AdminReports({ onLoggedOut }) {
  const [allReports, setAllReports] = useState([]);
  const [executives, setExecutives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("new"); // new | seen | feedback
  const [seenIds, setSeenIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("qf_seen_reports") || "[]")); }
    catch { return new Set(); }
  });
  const [selected, setSelected] = useState(null);
  const [fbText, setFbText] = useState("");
  const [fbSaving, setFbSaving] = useState(false);
  const [filterExec, setFilterExec] = useState("");
  const [filterRange, setFilterRange] = useState({ dateFrom: "", dateTo: "" });

  useEffect(() => {
    listUsers().then((r) => setExecutives(r.data.filter((u) => u.role === "executive")))
      .catch((e) => { if (e.response?.status === 401) onLoggedOut(); });
    fetchReports();
  }, []); // eslint-disable-line
  useRealtimeRefresh(["reports", "report_feedbacks"], fetchReports);
  useRealtimeRefresh(["users"], () => {
    listUsers().then((r) => setExecutives(r.data.filter((u) => u.role === "executive")));
  });

  function fetchReports() {
    setLoading(true);
    listAllReports()
      .then((r) => setAllReports(r.data))
      .catch((err) => { if (err.response?.status === 401) onLoggedOut(); })
      .finally(() => setLoading(false));
  }

  function markSeen(id) {
    setSeenIds((prev) => {
      const next = new Set(prev); next.add(id);
      localStorage.setItem("qf_seen_reports", JSON.stringify([...next]));
      return next;
    });
  }

  function openDetail(r) {
    markSeen(r.id);
    setSelected(r); setFbText(r.admin_feedback || "");
  }

  async function handleFeedback() {
    if (!fbText.trim() || !selected) return;
    setFbSaving(true);
    try {
      const res = await submitFeedback(selected.id, fbText.trim());
      const updated = res.data;
      setAllReports((p) => p.map((r) => r.id === updated.id ? updated : r));
      setSelected(updated);
    } finally { setFbSaving(false); }
  }

  const filtered = allReports.filter((r) => {
    if (filterExec && r.executive_id !== filterExec) return false;
    const reportDate = r.report_date?.slice(0, 10) || "";
    if (filterRange.dateFrom && reportDate < filterRange.dateFrom) return false;
    if (filterRange.dateTo && reportDate > filterRange.dateTo) return false;
    return true;
  });

  const tabs = {
    new: filtered.filter((r) => !seenIds.has(r.id)),
    seen: filtered.filter((r) => seenIds.has(r.id) && !r.admin_feedback),
    feedback: filtered.filter((r) => !!r.admin_feedback),
  };

  if (selected) return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <button onClick={() => setSelected(null)} className="back-button mb-4">
        <ArrowLeftIcon className="h-3.5 w-3.5" /> Back
      </button>
      <ReportCard r={selected} />
      {/* Feedback box */}
      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-slate-700">Admin Feedback</h3>
        {selected.admin_feedback && (
          <div className="mb-3 rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3">
            <div className="mb-1 text-[10px] font-bold text-amber-700">Sent Feedback</div>
            <div className="text-sm text-slate-700">{selected.admin_feedback}</div>
          </div>
        )}
        <textarea rows={3} placeholder="Feedback à¦²à¦¿à¦–à§à¦¨â€¦" value={fbText}
          onChange={(e) => setFbText(e.target.value)}
          className="input mb-3 w-full resize-none" />
        <button onClick={handleFeedback} disabled={fbSaving || !fbText.trim()}
          className="rounded-full bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50">
          {fbSaving ? "à¦ªà¦¾à¦ à¦¾à¦¨à§‹ à¦¹à¦šà§à¦›à§‡â€¦" : "Feedback à¦ªà¦¾à¦ à¦¾à¦¨"}
        </button>
      </div>
      <style>{`
        .input { width: 100%; border: 1px solid #E2E8F0; border-radius: 10px; padding: 8px 11px; font-size: 12.5px; outline: none; background: #F8FAFC; transition: border-color .15s, box-shadow .15s, background .15s; }
        .input:focus { border-color: #A5B4FC; box-shadow: 0 0 0 3px #EEF2FF; background: #fff; }
      `}</style>
    </div>
  );

  return (
    <div className="w-full max-w-none px-2 py-6 sm:px-3">
      <div className="mb-5">
        <h1 className="text-xl font-black text-slate-900">Reports</h1>
        <p className="mt-0.5 text-xs text-slate-500">à¦¸à¦•à¦² communicator à¦à¦° submitted reportà¥¤</p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2.5">
        <select value={filterExec} onChange={(e) => setFilterExec(e.target.value)} className="input min-w-[150px] flex-1">
          <option value="">All Communicators</option>
          {executives.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <PeriodRangeFilter onChange={setFilterRange} />
        <button onClick={() => { setFilterExec(""); setFilterRange({ dateFrom: "", dateTo: "" }); }}
          className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50">Reset</button>
      </div>

      {/* Tabs */}
      <div className="mb-5 inline-flex w-full gap-1 rounded-full bg-slate-100 p-1 sm:w-auto">
        {[["new", "à¦¨à¦¤à§à¦¨"], ["seen", "à¦¦à§‡à¦–à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡"], ["feedback", "Feedback à¦¦à§‡à¦“à¦¯à¦¼à¦¾"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all sm:flex-none ${tab === k ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            {l}
            {tabs[k].length > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tab === k ? "bg-indigo-50 text-indigo-600" : "bg-slate-200 text-slate-500"}`}>{tabs[k].length}</span>}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-14 text-sm font-semibold text-slate-500">
          <LoaderIcon className="h-4 w-4 animate-spin text-indigo-600" /> à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡â€¦
        </div>
      )}
      {!loading && tabs[tab].length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white py-14 text-center text-sm text-slate-400 shadow-sm">à¦•à§‹à¦¨à§‹ report à¦¨à§‡à¦‡à¥¤</div>
      )}

      {!loading && tabs[tab].length > 0 && (
        <ReportTable
          reports={tabs[tab]}
          mode="admin"
          seenIds={seenIds}
          onOpen={openDetail}
        />
      )}
      <style>{`
        .input { border: 1px solid #E2E8F0; border-radius: 10px; padding: 8px 11px; font-size: 12.5px; outline: none; background: #F8FAFC; transition: border-color .15s, box-shadow .15s, background .15s; }
        .input:focus { border-color: #A5B4FC; box-shadow: 0 0 0 3px #EEF2FF; background: #fff; }
      `}</style>
    </div>
  );
}

function ReportTable({ reports, mode, seenIds = new Set(), onOpen }) {
  function statusFor(report) {
    if (report.admin_feedback) {
      return { label: "Feedback à¦¦à§‡à¦“à¦¯à¦¼à¦¾", badge: "bg-emerald-100 text-emerald-800" };
    }
    if (mode === "admin" && !seenIds.has(report.id)) {
      return { label: "à¦¨à¦¤à§à¦¨", badge: "bg-indigo-100 text-indigo-800" };
    }
    if (mode === "admin") {
      return { label: "à¦¦à§‡à¦–à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡", badge: "bg-violet-100 text-violet-800" };
    }
    return { label: "Feedback à¦…à¦ªà§‡à¦•à§à¦·à¦®à¦¾à¦£", badge: "bg-amber-100 text-amber-800" };
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <ListScrollArea>
        <table className="w-full min-w-0 table-fixed border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Report / Purpose</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Communicator</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Report Date</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Center</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Status</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Submitted</th>
              <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">Action</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => {
              const status = statusFor(report);
              return (
                <tr
                  key={report.id}
                  onClick={() => onOpen(report)}
                  className="cursor-pointer border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <div className="max-w-[260px] truncate text-sm font-bold text-slate-900">
                      {report.purpose || report.specific_program || "Daily Report"}
                    </div>
                    {report.specific_program && report.purpose && (
                      <div className="mt-0.5 max-w-[260px] truncate text-[10px] text-slate-500">{report.specific_program}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700">
                    {report.executive_name || "à¦¨à¦¿à¦œà§‡à¦° report"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                    {report.report_date ? new Date(report.report_date).toLocaleDateString("en-GB") : "â€”"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{report.center || "â€”"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ${status.badge}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[11px] text-slate-500">
                    {report.created_at ? new Date(report.created_at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }) : "â€”"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(report);
                      }}
                      className="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500"
                    >
                      Open â†’
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ListScrollArea>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   SHARED: Report Detail Card
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function ReportCard({ r }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header â€” flat single color, no gradient */}
      <div className="bg-indigo-600 px-6 py-5 text-white">
        <div className="text-center">
          <div className="text-lg font-black tracking-wide">â€” à¦¸à¦‚à¦¯à§‹à¦—à¦¾à¦¯à¦¼à¦¨ à¦¸à¦¾à¦°à¦¾à¦‚à¦¶ â€”</div>
          <div className="mt-0.5 text-xs text-indigo-100">Submitted Contact Report</div>
        </div>
        <div className="mt-3 flex justify-end">
          <div className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs text-indigo-50">
            à¦¤à¦¾à¦°à¦¿à¦–: {r.report_date ? new Date(r.report_date).toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric" }) : "â€”"}
          </div>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {/* Basic Info + Contact + Time â€” 3 col */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* 1. Basic */}
          <CardSection icon={InfoIcon} title="1. Basic Information">
            <InfoRow label="à¦¨à¦¾à¦®" value={r.executive_name} />
            <InfoRow label="à¦ªà¦¦à¦¬à§€" value={r.designation} />
            <InfoRow label="à¦®à§‹à¦¬à¦¾à¦‡à¦²" value={r.mobile} />
            <InfoRow label="à¦¸à§‡à¦•à§à¦Ÿà¦°/à¦¶à¦¾à¦–à¦¾/à¦¸à§‡à¦²" value={r.center} />
            <InfoRow label="à¦ªà§à¦°à§‹à¦—à§à¦°à¦¾à¦®/à¦‰à¦¦à§à¦¦à§‡à¦¶à§à¦¯" value={r.purpose} />
            <InfoRow label="à¦¸à§à¦¨à¦¿à¦°à§à¦¦à¦¿à¦·à§à¦Ÿ à¦ªà§à¦°à§‹à¦—à§à¦°à¦¾à¦®" value={r.specific_program} />
            <InfoRow label="à¦¯à¦¾à¦¦à§‡à¦° à¦¸à¦¾à¦¥à§‡ à¦¯à§‹à¦—à¦¾à¦¯à§‹à¦—" value={r.contact_target} />
          </CardSection>

          {/* 2. Contact */}
          <CardSection icon={PhoneIcon} title="2. Contact Summary">
            <StageSummary stages={r.stage_summary} conversions={r.stage_conversions} />
          </CardSection>

          {/* 3. Time */}
          <CardSection icon={HistoryIcon} title="à§©. à¦¸à¦‚à¦¯à§‹à¦—à¦¾à¦¯à¦¼à¦¨à§‡à¦° à¦¸à¦®à¦¯à¦¼">
            <InfoRow label="à¦¸à¦®à¦¯à¦¼ à§§" value={r.time1_start && r.time1_end ? `${r.time1_start} â€“ ${r.time1_end}` : "â€”"} />
            <InfoRow label="à¦¸à¦®à¦¯à¦¼ à§¨" value={r.time2_start && r.time2_end ? `${r.time2_start} â€“ ${r.time2_end}` : "â€”"} />
            <InfoRow label="à¦¸à¦®à¦¯à¦¼ à§©" value={r.time3_start && r.time3_end ? `${r.time3_start} â€“ ${r.time3_end}` : "â€”"} />
            <InfoRow label="à¦®à§‹à¦Ÿ à¦¸à¦®à¦¯à¦¼" value={formatDuration(getTotalDuration([r.time1_start, r.time1_end], [r.time2_start, r.time2_end], [r.time3_start, r.time3_end]))} />
            <InfoRow label="à¦¸à¦‚à¦¯à§‹à¦—à¦¾à¦¯à¦¼à¦¨à§‡à¦° à¦†à¦—à§‡ à¦®à§‡à¦¡à¦¿à¦Ÿà§‡à¦¶à¦¨" value={r.meditation_before} />
            <InfoRow label="à¦¸à¦‚à¦¯à§‹à¦—à¦¾à¦¯à¦¼à¦¨ à¦¶à§‡à¦·à§‡ à¦ªà§à¦°à¦¾à¦°à§à¦¥à¦¨à¦¾" value={r.prayer_after} />
          </CardSection>
        </div>

        {/* 4. C&A */}
        <CardSection icon={ClipboardIcon} title="4. C & A Summary">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="mb-1 border-b border-slate-100 pb-1 text-[10px] font-bold text-slate-600">à¦†à¦œà¦•à§‡à¦° à¦¸à¦‚à¦¯à§‹à¦—à¦¾à¦¯à¦¼à¦¨à§‡à¦° à¦‡à¦¤à¦¿à¦¬à¦¾à¦šà¦• à¦¦à¦¿à¦•</p>
              <ul className="space-y-0.5">{(r.positives || "").split("\n").filter(Boolean).map((l, i) => <li key={i} className="flex gap-1 text-xs text-slate-500"><span>â€¢</span>{l}</li>)}</ul>
            </div>
            <div>
              <p className="mb-1 border-b border-slate-100 pb-1 text-[10px] font-bold text-slate-600">à¦¯à§‡à¦¸à¦¬ à¦šà§à¦¯à¦¾à¦²à§‡à¦žà§à¦œ à¦¹à¦¯à¦¼à§‡à¦›à§‡</p>
              <ul className="space-y-0.5">{(r.challenges || "").split("\n").filter(Boolean).map((l, i) => <li key={i} className="flex gap-1 text-xs text-slate-500"><span>â€¢</span>{l}</li>)}</ul>
            </div>
            <div>
              <p className="mb-1 border-b border-slate-100 pb-1 text-[10px] font-bold text-slate-600">à¦†à¦ªà¦¨à¦¾à¦° à¦ªà¦°à¦¾à¦®à¦°à§à¦¶</p>
              <ul className="space-y-0.5">{(r.suggestions || "").split("\n").filter(Boolean).map((l, i) => <li key={i} className="flex gap-1 text-xs text-slate-500"><span>â€¢</span>{l}</li>)}</ul>
            </div>
          </div>
        </CardSection>

        <div className="text-right text-[10px] text-slate-400">
          à¦œà¦®à¦¾ à¦¦à§‡à¦“à¦¯à¦¼à¦¾à¦° à¦¸à¦®à¦¯à¦¼: {r.created_at ? new Date(r.created_at).toLocaleString("bn-BD") : ""}
        </div>
      </div>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   SUBMIT FORM
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function SubmitForm({ currentUser, onSuccess, onCancel, onLoggedOut }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [designation, setDesignation] = useState("");
  const [mobile, setMobile] = useState("");
  const [center, setCenter] = useState("");
  const [purpose, setPurpose] = useState("");
  const [specificProgram, setSpecificProgram] = useState("");
  const [contactTarget, setContactTarget] = useState("");
  const [stageSummary, setStageSummary] = useState([]);
  const [stageConversions, setStageConversions] = useState([]);
  const [time1Start, setTime1Start] = useState("");
  const [time1End, setTime1End] = useState("");
  const [time2Start, setTime2Start] = useState("");
  const [time2End, setTime2End] = useState("");
  const [time3Start, setTime3Start] = useState("");
  const [time3End, setTime3End] = useState("");
  const [meditationBefore, setMeditationBefore] = useState("à¦¹à§à¦¯à¦¾à¦");
  const [prayerAfter, setPrayerAfter] = useState("à¦¹à§à¦¯à¦¾à¦");
  const [positives, setPositives] = useState("");
  const [challenges, setChallenges] = useState("");
  const [suggestions, setSuggestions] = useState("");

  useEffect(() => {
    if (!date) return;
    getReportPrefill(date).then((response) => {
      const prefill = response.data;
      setDesignation(prefill.designation || "");
      setMobile(prefill.phone || "");
      setCenter(prefill.center || "");
      setStageSummary(prefill.stage_summary || []);
      setStageConversions(prefill.stage_conversions || []);
    }).catch(() => {});
  }, [date]);

  async function handleSubmit(e) {
    e.preventDefault(); setError(""); setSubmitting(true);
    try {
      const res = await createReport({
        report_date: date ? new Date(date).toISOString() : null,
        designation, mobile, center, purpose,
        specific_program: specificProgram, contact_target: contactTarget,
        time1_start: time1Start, time1_end: time1End,
        time2_start: time2Start, time2_end: time2End,
        time3_start: time3Start, time3_end: time3End,
        meditation_before: meditationBefore, prayer_after: prayerAfter,
        positives, challenges, suggestions,
      });
      onSuccess(res.data);
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      setError(detail || "Report à¦œà¦®à¦¾ à¦¦à§‡à¦“à¦¯à¦¼à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤");
      if (status === 401 && typeof onLoggedOut === "function") onLoggedOut();
    }
    finally { setSubmitting(false); }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <button onClick={onCancel} className="back-button mb-4">
          <ArrowLeftIcon className="h-3.5 w-3.5" /> Back
        </button>
        <div className="pl-1">
          <h1 className="text-xl font-black text-slate-900">à¦¨à¦¤à§à¦¨ Report à¦œà¦®à¦¾ à¦¦à¦¿à¦¨</h1>
          <p className="mt-0.5 text-xs text-slate-500">à¦†à¦ªà¦¨à¦¾à¦° à¦¦à§ˆà¦¨à¦¨à§à¦¦à¦¿à¦¨ à¦•à¦¾à¦œà§‡à¦° à¦¸à¦¾à¦°à¦¸à¦‚à¦•à§à¦·à§‡à¦ªà¥¤</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Section title="à¦®à§‚à¦² à¦¤à¦¥à§à¦¯">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="à¦¤à¦¾à¦°à¦¿à¦–"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input w-full" /></Field>
            <Field label="à¦¨à¦¾à¦®"><input readOnly value={currentUser?.name || ""} className="input w-full bg-slate-50 text-slate-500" /></Field>
            <Field label="à¦ªà¦¦à¦¬à§€"><input readOnly value={designation} className="input w-full bg-slate-100 text-slate-600" /></Field>
            <Field label="à¦®à§‹à¦¬à¦¾à¦‡à¦²"><input required readOnly value={mobile} className="input w-full bg-slate-100 text-slate-600" /></Field>
            <Field label="à¦¸à§‡à¦¨à§à¦Ÿà¦¾à¦°/à¦¶à¦¾à¦–à¦¾/à¦¸à§‡à¦²"><input value={center} onChange={(e) => setCenter(e.target.value)} placeholder="à¦¸à§‡à¦¨à§à¦Ÿà¦¾à¦° à¦²à¦¿à¦–à§à¦¨" className="input w-full" /></Field>
            <Field label="à¦ªà§à¦°à§‹à¦—à§à¦°à¦¾à¦®/à¦‰à¦¦à§à¦¦à§‡à¦¶à§à¦¯"><input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="à¦‰à¦¦à§à¦¦à§‡à¦¶à§à¦¯ à¦²à¦¿à¦–à§à¦¨" className="input w-full" /></Field>
            <Field label="à¦¸à§à¦¨à¦¿à¦°à§à¦¦à¦¿à¦·à§à¦Ÿ à¦ªà§à¦°à§‹à¦—à§à¦°à¦¾à¦®" className="sm:col-span-2 lg:col-span-3"><input value={specificProgram} onChange={(e) => setSpecificProgram(e.target.value)} placeholder="à¦¸à§à¦¨à¦¿à¦°à§à¦¦à¦¿à¦·à§à¦Ÿ à¦ªà§à¦°à§‹à¦—à§à¦°à¦¾à¦®" className="input w-full" /></Field>
          </div>
        </Section>
        <Section title="Contact Summary">
          <Field label="à¦¯à¦¾à¦¦à§‡à¦° à¦¸à¦¾à¦¥à§‡ à¦¯à§‹à¦—à¦¾à¦¯à§‹à¦— à¦•à¦°à¦¾ à¦¹à¦šà§à¦›à§‡" className="mb-4 max-w-sm">
            <input value={contactTarget} onChange={(e) => setContactTarget(e.target.value)} className="input w-full" />
          </Field>
          <StageSummary stages={stageSummary} conversions={stageConversions} />
        </Section>
        <Section title="à¦¸à¦‚à¦¯à§‹à¦—à¦¾à¦¯à¦¼à¦¨à§‡à¦° à¦¸à¦®à¦¯à¦¼">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <TimeRow label="à¦¸à¦®à¦¯à¦¼ à§§" start={time1Start} end={time1End} onStart={setTime1Start} onEnd={setTime1End} />
              <TimeRow label="à¦¸à¦®à¦¯à¦¼ à§¨" start={time2Start} end={time2End} onStart={setTime2Start} onEnd={setTime2End} />
              <TimeRow label="à¦¸à¦®à¦¯à¦¼ à§©" start={time3Start} end={time3End} onStart={setTime3Start} onEnd={setTime3End} />
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-semibold text-slate-600">à¦®à§‹à¦Ÿ à¦¸à¦‚à¦¯à§‹à¦— à¦¸à¦®à¦¯à¦¼</div>
                <div className="mt-2 text-2xl font-black text-slate-900">
                  {formatDuration(getTotalDuration([time1Start, time1End], [time2Start, time2End], [time3Start, time3End]))}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <Field label="à¦¸à¦‚à¦¯à§‹à¦—à¦¾à¦¯à¦¼à¦¨à§‡à¦° à¦†à¦—à§‡ à¦®à§‡à¦¡à¦¿à¦Ÿà§‡à¦¶à¦¨">
                <select value={meditationBefore} onChange={(e) => setMeditationBefore(e.target.value)} className="input w-full"><option>à¦¹à§à¦¯à¦¾à¦</option><option>à¦¨à¦¾</option></select>
              </Field>
              <Field label="à¦¸à¦‚à¦¯à§‹à¦—à¦¾à¦¯à¦¼à¦¨ à¦¶à§‡à¦·à§‡ à¦ªà§à¦°à¦¾à¦°à§à¦¥à¦¨à¦¾">
                <select value={prayerAfter} onChange={(e) => setPrayerAfter(e.target.value)} className="input w-full"><option>à¦¹à§à¦¯à¦¾à¦</option><option>à¦¨à¦¾</option></select>
              </Field>
            </div>
          </div>
        </Section>
        <Section title="C & A Summary">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="à¦†à¦œà¦•à§‡à¦° à¦‡à¦¤à¦¿à¦¬à¦¾à¦šà¦• à¦¦à¦¿à¦•"><textarea rows={3} value={positives} onChange={(e) => setPositives(e.target.value)} placeholder="à¦‡à¦¤à¦¿à¦¬à¦¾à¦šà¦• à¦¦à¦¿à¦•à¦—à§à¦²à§‹ à¦²à¦¿à¦–à§à¦¨..." className="input w-full resize-none" /></Field>
            <Field label="à¦¯à§‡à¦¸à¦¬ à¦šà§à¦¯à¦¾à¦²à§‡à¦žà§à¦œ à¦¹à¦¯à¦¼à§‡à¦›à§‡"><textarea rows={3} value={challenges} onChange={(e) => setChallenges(e.target.value)} placeholder="à¦šà§à¦¯à¦¾à¦²à§‡à¦žà§à¦œà¦—à§à¦²à§‹ à¦²à¦¿à¦–à§à¦¨..." className="input w-full resize-none" /></Field>
            <Field label="à¦†à¦ªà¦¨à¦¾à¦° à¦ªà¦°à¦¾à¦®à¦°à§à¦¶"><textarea rows={3} value={suggestions} onChange={(e) => setSuggestions(e.target.value)} placeholder="à¦ªà¦°à¦¾à¦®à¦°à§à¦¶ à¦²à¦¿à¦–à§à¦¨..." className="input w-full resize-none" /></Field>
          </div>
        </Section>
        {error && <div className="rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onCancel} className="rounded-full border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-600">Cancel</button>
          <button type="submit" disabled={submitting} className="rounded-full bg-indigo-600 px-8 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-60">
            {submitting ? "à¦œà¦®à¦¾ à¦¹à¦šà§à¦›à§‡..." : "à¦œà¦®à¦¾ à¦¦à¦¿à¦¨"}
          </button>
        </div>
      </form>
      <style>{`
        .input { border: 1px solid #E2E8F0; border-radius: 10px; padding: 8px 11px; font-size: 12.5px; outline: none; background: #F8FAFC; transition: border-color .15s, box-shadow .15s, background .15s; }
        .input:focus { border-color: #A5B4FC; box-shadow: 0 0 0 3px #EEF2FF; background: #fff; }
      `}</style>
    </div>
  );
}

/* â”€â”€ Small Helpers â”€â”€ */
function Section({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 border-b border-slate-100 pb-2 text-sm font-bold text-slate-700">{title}</h3>
      {children}
    </div>
  );
}
function StageSummary({ stages = [], conversions = [] }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Completed task stages</p>
        {stages.length ? (
          <div className="grid grid-cols-2 gap-2">
            {stages.map((item) => <ContactRow key={item.stage} label={item.stage} value={item.count} />)}
          </div>
        ) : <p className="text-xs text-slate-400">à¦à¦‡ à¦¤à¦¾à¦°à¦¿à¦–à§‡ à¦•à§‹à¦¨à§‹ completed stage à¦¨à§‡à¦‡à¥¤</p>}
      </div>
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Stage conversion</p>
        {conversions.length ? (
          <div className="space-y-1.5">
            {conversions.map((item) => (
              <div key={`${item.from_stage}-${item.to_stage}`} className="flex items-center justify-between rounded-lg bg-indigo-50 px-3 py-2 text-xs">
                <span className="font-semibold text-slate-700">{item.from_stage} â†’ {item.to_stage}</span>
                <span className="font-black text-indigo-700">{item.count}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-xs text-slate-400">à¦à¦‡ à¦¤à¦¾à¦°à¦¿à¦–à§‡ à¦•à§‹à¦¨à§‹ stage conversion à¦¨à§‡à¦‡à¥¤</p>}
      </div>
    </div>
  );
}
function Field({ label, children, className = "" }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</label>
      {children}
    </div>
  );
}
function TimeRow({ label, start, end, onStart, onEnd }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 flex-shrink-0 text-xs font-semibold text-slate-500">{label}</span>
      <input type="time" value={start} onChange={(e) => onStart(e.target.value)} className="input flex-1" />
      <span className="text-xs text-slate-400">â€“</span>
      <input type="time" value={end} onChange={(e) => onEnd(e.target.value)} className="input flex-1" />
    </div>
  );
}
function parseTimeToMinutes(value) {
  if (!value) return 0;
  const [hours, minutes] = String(value).split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}
function getTotalDuration(...pairs) {
  return pairs.reduce((total, [start, end]) => {
    if (!start || !end) return total;
    const duration = parseTimeToMinutes(end) - parseTimeToMinutes(start);
    return total + Math.max(0, duration);
  }, 0);
}
function formatDuration(minutes) {
  if (!minutes) return "â€”";
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs > 0 ? `${hrs}h ` : ""}${mins}m`.trim();
}
function _CountCard({ label, value, onChange }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <label className="mb-2 block text-xs font-semibold text-slate-700">{label}</label>
      <input type="number" min="0" placeholder="0" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100" />
    </div>
  );
}
function CardSection({ icon: Icon, title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <h4 className="mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2 text-xs font-bold text-slate-700">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><Icon className="h-3.5 w-3.5" /></span>
        {title}
      </h4>
      {children}
    </div>
  );
}
function InfoRow({ label, value }) {
  return (
    <div className="flex gap-2 py-0.5">
      <span className="w-28 flex-shrink-0 text-[10px] text-slate-400">{label}</span>
      <span className="text-[11px] font-semibold text-slate-700">{value || "â€”"}</span>
    </div>
  );
}
function ContactRow({ label, value }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-[10px] text-slate-500">{label} :</span>
      <span className="text-[11px] font-bold text-slate-700">{value ?? 0}</span>
    </div>
  );
}
