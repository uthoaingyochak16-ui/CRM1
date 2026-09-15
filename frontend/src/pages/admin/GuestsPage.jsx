import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { listCustomers } from "../../api/guest.js";
import LimitReachedModal from "../../components/LimitReachedModal.jsx";
import SortDropdown from "../../components/SortDropdown.jsx";
import { sortItems } from "../../utils/sort.js";
import { SearchIcon, PhoneIcon, ClipboardIcon, ArrowRightIcon } from "../../components/Icons.jsx";
import { useRealtimeRefresh } from "../../realtime/RealtimeContext.jsx";
import ProfileAvatar from "../../components/ProfileAvatar.jsx";
import ListScrollArea from "../../components/ListScrollArea.jsx";

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
  Interested: "bg-sky-50/70", Dropped: "bg-rose-50/70", Counselling: "bg-amber-50/70",
  Associate: "bg-violet-50/70", "Course Acc": "bg-indigo-50/70", "Potential Batch": "bg-teal-50/70",
  QG: "bg-emerald-50/70", Quantier: "bg-green-50/70", QPM: "bg-fuchsia-50/70",
  Ardentiar: "bg-orange-50/70", Organier: "bg-cyan-50/70", Foreigner: "bg-lime-50/70",
};

function formatAssignmentDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function CustomersPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("");

  const [sortKey, setSortKey] = useState("name:asc");
  const [limitNotice, setLimitNotice] = useState("");

  const SORT_OPTIONS = [
    { value: "name:asc", label: "Name A-Z" },
    { value: "name:desc", label: "Name Z-A" },
    { value: "date:desc", label: "Newest first" },
    { value: "date:asc", label: "Oldest first" },
    { value: "stage:asc", label: "Stage A-Z" },
  ];
  const SORT_GETTERS = {
    name: (c) => (c.full_name || "").toLowerCase(),
    date: (c) => new Date(c.updated_at || c.created_at || 0).getTime(),
    stage: (c) => (c.stage || "").toLowerCase(),
  };

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const customersRes = await listCustomers(searchQuery);
      setCustomers(customersRes.data || []);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      if (/limit|পূর্ণ হয়েছে/i.test(detail)) setLimitNotice(detail);
      else setError(detail);
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  }

  useEffect(() => { load(); }, [searchQuery]); // eslint-disable-line
  useRealtimeRefresh(["customers", "tasks", "registrations", "users"], load);

  const stages = [...new Set(customers.map((c) => c.stage).filter(Boolean))];
  const filtered = customers.filter((c) => !stageFilter || c.stage === stageFilter);
  const sortedCustomers = sortItems(filtered, sortKey, SORT_GETTERS);

  const escapeCsv = (value) => {
    const text = value == null ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };

  const downloadCSV = () => {
    const headers = ["Name", "Phone", "Email", "Location", "Profession", "Age", "Stage", "Programs"];
    const rows = sortedCustomers.map((c) => [
      c.full_name || "",
      c.mobile || "",
      c.email || "",
      c.location || "",
      c.profession || "",
      c.age != null ? c.age : "",
      c.stage || "",
      c.programs_count ?? 0,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "guest-profiles.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const downloadPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const headers = ["Name", "Phone", "Email", "Location", "Profession", "Age", "Stage", "Programs"];
    const rows = sortedCustomers.map((c) => [
      c.full_name || "",
      c.mobile || "",
      c.email || "",
      c.location || "",
      c.profession || "",
      c.age != null ? String(c.age) : "",
      c.stage || "",
      String(c.programs_count ?? 0),
    ]);
    autoTable(doc, {
      head: [headers],
      body: rows,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [248, 250, 252], textColor: [51, 65, 85], fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { cellWidth: 90 },
        2: { cellWidth: 140 },
        3: { cellWidth: 120 },
        4: { cellWidth: 110 },
        5: { cellWidth: 40 },
        6: { cellWidth: 90 },
        7: { cellWidth: 60 },
      },
      tableLineWidth: 0.5,
      tableLineColor: 200,
    });
    doc.save("guest-profiles.pdf");
  };

  if (!hasLoaded) return <div className="p-6 text-center text-sm text-slate-500">লোডিং...</div>;

  return (
    <div className="w-full max-w-none space-y-3 px-1 py-2 md:px-2">
      <LimitReachedModal message={limitNotice} onClose={() => setLimitNotice("")} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900"></h1>
          <p className="mt-0.5 text-xs font-medium text-slate-400">{sortedCustomers.length} guest{sortedCustomers.length !== 1 ? "s" : ""}</p>
        </div>
        <SortDropdown value={sortKey} onChange={setSortKey} options={SORT_OPTIONS} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Object.keys(STAGE_COLORS).map((stage) => (
          <button key={stage} onClick={() => setStageFilter(stageFilter === stage ? "" : stage)}
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${STAGE_COLORS[stage]} ${stageFilter === stage ? "outline outline-2 outline-offset-1 outline-blue-500" : ""}`}>
            {stage}
          </button>
        ))}
      </div>

      {/* Toolbar: search on its own row, filter+CSV+PDF share one compact row on mobile */}
      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="নাম, ফোন, profession, remarks বা profile-এর যেকোনো data খুঁজুন..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
          />
        </div>
        <div className="flex items-center gap-1.5 md:flex-wrap">
          {stages.length > 0 && (
            <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-2 text-[10px] font-semibold text-slate-600 outline-none focus:border-blue-500 md:flex-none md:px-3 md:text-xs">
              <option value="">All Stages</option>
              {stages.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <button onClick={downloadCSV}
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-[10px] font-bold text-slate-700 hover:bg-slate-50 md:px-3 md:text-xs">
            CSV
          </button>
          <button onClick={downloadPDF}
            className="shrink-0 rounded-lg bg-blue-600 px-2.5 py-2 text-[10px] font-bold text-white hover:bg-blue-700 md:px-3 md:text-xs">
            PDF
          </button>
        </div>
      </div>
      {loading && <div className="text-xs font-semibold text-blue-600">Searching...</div>}

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

      {sortedCustomers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-400">
          কোন অতিথি পাওয়া যায়নি।
        </div>
      ) : (
        <>
          {/* Mobile card list: name, phone, profession, age, stage — whole card is the click target */}
          <div className="space-y-2 md:hidden">
            {sortedCustomers.map((c, idx) => {
              const stageClass = STAGE_COLORS[c.stage] || "bg-slate-50 text-slate-600 ring-slate-200";
              const zebraBase = idx % 2 === 0 ? "bg-blue-100/80" : "bg-white";
              return (
                <div
                  key={c.id}
                  onClick={() => navigate(`/admin/customers/${c.id}`)}
                  className={`flex items-center gap-3 rounded-xl border border-slate-200 p-3 shadow-sm active:brightness-95 ${zebraBase}`}
                >
                  <ProfileAvatar name={c.full_name} imageUrl={c.profile_image_url} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold text-slate-900">{c.full_name || "(নাম নেই)"}</span>
                      {c.stage && (
                        <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold ring-1 ring-inset ${stageClass}`}>
                          {c.stage}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-col items-start gap-1 text-[11px] font-medium text-slate-500">
                      {(c.last_assigned_comm_name || c.last_assigned_at) && (
                        <div className="text-[10px] font-semibold text-indigo-600">
                          Assigned to {c.last_assigned_comm_name || "—"}
                          {c.last_assigned_at ? ` • ${formatAssignmentDate(c.last_assigned_at)}` : ""}
                        </div>
                      )}
                      {c.mobile && (
                        <span className="flex items-center gap-1">
                          <PhoneIcon className="h-3 w-3 text-slate-400" />{c.mobile}
                        </span>
                      )}
                      {c.profession && <span className="truncate">{c.profession}</span>}
                      {c.age != null && <span>Age {c.age}</span>}
                    </div>
                  </div>
                  <ArrowRightIcon className="h-4 w-4 shrink-0 text-slate-300" />
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <ListScrollArea>
              <table className="w-full min-w-0 table-fixed border-collapse text-left">
                <colgroup>
                  <col className="w-[28%]" />
                  <col className="w-[16%]" />
                  <col className="w-[18%]" />
                  <col className="w-[8%]" />
                  <col className="w-[16%]" />
                  <col className="w-[8%]" />
                  <col className="w-[6%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Name</th>
                    <th className="px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Phone</th>
                    <th className="px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Profession</th>
                    <th className="px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Age</th>
                    <th className="px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Stage</th>
                    <th className="px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Programs</th>
                    <th className="px-4 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCustomers.map((c, idx) => {
                    const stageClass = STAGE_COLORS[c.stage] || "bg-slate-50 text-slate-600 ring-slate-200";
                    const zebraBase = idx % 2 === 0 ? "bg-blue-100/80" : "bg-white";
                    return (
                      <tr key={c.id}
                        className={`border-b border-slate-100 last:border-b-0 transition-colors cursor-pointer ${zebraBase} hover:brightness-95`}
                        onClick={() => navigate(`/admin/customers/${c.id}`)}>
                        <td className="px-4 py-2.5 align-middle">
                          <div className="flex items-center gap-2.5">
                            <ProfileAvatar name={c.full_name} imageUrl={c.profile_image_url} />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-slate-900">{c.full_name || "(নাম নেই)"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 align-middle text-xs font-medium text-slate-600">
                          {c.mobile ? (
                            <span className="flex items-center gap-1"><PhoneIcon className="h-3 w-3 text-slate-400" /> {c.mobile}</span>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 align-middle text-xs font-medium text-slate-600">
                          {c.profession ? (
                            <span className="truncate">{c.profession}</span>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 align-middle text-xs font-medium text-slate-600">
                          {c.age != null ? c.age : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 align-middle">
                          <div className="flex flex-col items-start gap-1">
                            {c.stage ? (
                              <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-bold ring-1 ring-inset ${stageClass}`}>{c.stage}</span>
                            ) : <span className="text-xs text-slate-300">—</span>}
                            {(c.last_assigned_comm_name || c.last_assigned_at) && (
                              <div className="text-[10px] font-semibold text-indigo-600">
                                {c.last_assigned_comm_name || "—"}
                                {c.last_assigned_at ? ` • ${formatAssignmentDate(c.last_assigned_at)}` : ""}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 align-middle text-xs font-medium text-slate-600">
                          <span className="flex items-center gap-1"><ClipboardIcon className="h-3 w-3 text-slate-400" /> {c.programs_count}</span>
                        </td>
                        <td className="px-4 py-2.5 align-middle text-right" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => navigate(`/admin/customers/${c.id}`)}
                            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700">
                            Open <ArrowRightIcon className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ListScrollArea>
          </div>
        </>
      )}
    </div>
  );
}