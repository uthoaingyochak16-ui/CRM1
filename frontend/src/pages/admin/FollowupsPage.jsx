import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { listAllFollowups } from "../../api/guest.js";
import { useRealtimeRefresh } from "../../realtime/realtimeHooks.js";
import { arrangeDataEntries } from "../../utils/dataArrangement.js";
import ProfileAvatar from "../../components/ProfileAvatar.jsx";
import ListScrollArea from "../../components/ListScrollArea.jsx";
import PeriodRangeFilter from "../../components/PeriodRangeFilter.jsx";

const EMPTY_FILTERS = {
  q: "",
  dateFrom: "",
  dateTo: "",
  period: "",
};

function selectedDateRange(filters) {
  return { from: filters.dateFrom, to: filters.dateTo };
}

export default function FollowupsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    setError("");
    const params = {};
    if (filters.q.trim()) params.q = filters.q.trim();
    const range = selectedDateRange(filters);
    if (range.from) params.date_from = range.from;
    if (range.to) params.date_to = range.to;
    listAllFollowups(params)
      .then((response) => setRows(response.data))
      .catch((requestError) => {
        setRows([]);
        setError(requestError.response?.data?.detail || "Follow-up list load করা যায়নি।");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps
  useRealtimeRefresh(["customer_followups", "tasks", "customers"], load);

  function setFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function truncateWords(text, maxWords = 4) {
    const normalized = String(text || "").trim();
    if (!normalized) return "—";
    const words = normalized.split(/\s+/);
    if (words.length <= maxWords) return normalized;
    return words.slice(0, maxWords).join(" ") + "...";
  }

  function calculateAge(dateOfBirth) {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 0 ? age : null;
  }

  function formatAge(row) {
    const age = row.age != null ? row.age : (row.date_of_birth ? calculateAge(row.date_of_birth) : null);
    return age != null ? `${age} বছর` : "—";
  }

  const exportRows = rows.map((row) => {
    const age = row.age != null ? row.age : (row.date_of_birth ? calculateAge(row.date_of_birth) : null);
    return [
      row.name, row.mobile, row.profession, row.location, age ?? "", row.stage,
      row.consultant, new Date(row.scheduled_at).toLocaleString("en-GB"),
      row.completed ? "Completed" : "Pending", row.note, row.result,
      row.customer_problem, row.executive_remarks,
    ];
  });
  const headers = ["Name", "Phone", "Profession", "Location", "Age", "Stage", "Communicator", "Follow-up Date", "Status", "Note", "Result", "Problem", "Remarks"];
  const selectedArrangement = selected ? arrangeDataEntries({
    Name: selected.name,
    Phone: selected.mobile,
    Email: selected.email,
    Profession: selected.profession,
    Location: selected.location,
    Age: selected.age,
    "Date of Birth": selected.date_of_birth || undefined,
    "Guest Problem": selected.customer_problem || undefined,
    "Communicator Remarks": selected.executive_remarks || undefined,
    Stage: selected.stage,
    Communicator: selected.consultant,
    "Follow-up Date": selected.scheduled_at,
    "Follow-up Note": selected.note,
    Result: selected.result,
    ...selected.profile_data,
  }) : null;

  function downloadCSV() {
    const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [headers, ...exportRows].map((row) => row.map(escape).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "followups.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(15);
    doc.text("Follow-up List", 36, 35);
    doc.setFontSize(9);
    doc.text(`${rows.length} records · ${new Date().toLocaleString("en-GB")}`, 36, 51);
    autoTable(doc, {
      head: [headers],
      body: exportRows,
      startY: 62,
      styles: { fontSize: 7, cellPadding: 3 },
      headStyles: { fillColor: [37, 84, 199] },
    });
    doc.save("followups.pdf");
  }

  return (
    <div className="w-full max-w-none px-2 py-3">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900"></h1>
          <p className="text-xs text-slate-500">সব follow-up search, filter এবং export করুন।</p>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadCSV} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700">CSV Download</button>
          <button onClick={downloadPDF} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white">PDF Download</button>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input !pl-9" placeholder="Stage, location, profession, communicator বা যেকোনো তথ্য লিখুন..." value={filters.q} onChange={(e) => setFilter("q", e.target.value)} />
        </div>
        <PeriodRangeFilter onChange={({ dateFrom, dateTo }) => setFilters((current) => ({ ...current, dateFrom, dateTo, period: "" }))} />
        {(filters.q || filters.dateFrom || filters.dateTo || filters.period) && <button onClick={() => setFilters(EMPTY_FILTERS)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600">Clear</button>}
      </div>

      {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</div>}
      <div className="mb-2 text-xs font-bold text-slate-500">{loading ? "Loading..." : `${rows.length} follow-ups found`}</div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <ListScrollArea>
          <table className="w-full min-w-0 table-auto text-left text-xs">
            <thead className="bg-slate-50 text-slate-700"><tr>
              {["Guest", "Age", "Profession", "Remarks / Problem", "Stage", "Follow-up Date", "Status"].map((head) => <th key={head} className={`px-3 py-3 font-bold ${head === "Guest" ? "w-[30%] min-w-0" : head === "Age" ? "w-[10%] whitespace-nowrap" : head === "Profession" ? "w-[12%]" : head === "Remarks / Problem" ? "w-[22%]" : head === "Stage" ? "w-[10%]" : head === "Follow-up Date" ? "w-[12%] whitespace-nowrap" : "w-[8%]"}`}>{head}</th>)}
            </tr></thead>
            <tbody>{rows.map((row) => <tr key={row.id} onClick={() => setSelected(row)} className="cursor-pointer border-t border-slate-100 hover:bg-blue-50/50">
              <td className="px-3 py-3"><div className="flex min-w-0 items-center gap-2.5"><ProfileAvatar name={row.name} imageUrl={row.profile_image_url} /><div className="min-w-0 flex-1"><b className="block truncate">{row.name}</b><div className="truncate text-slate-400">{row.mobile}</div></div></div></td>
              <td className="px-3 py-3 whitespace-nowrap">{formatAge(row)}</td>
              <td className="px-3 py-3">{row.profession || "—"}</td>
              <td className="min-w-0 px-3 py-3">
                <div className="truncate text-slate-700" title={row.executive_remarks || ""}><span className="font-semibold">Remarks:</span> {truncateWords(row.executive_remarks)}</div>
                <div className="mt-0.5 truncate text-slate-400" title={row.customer_problem || ""}><span className="font-semibold">Problem:</span> {truncateWords(row.customer_problem)}</div>
              </td>
              <td className="px-3 py-3">
                <div className="font-bold text-blue-700">{row.stage || "—"}</div>
                {row.consultant && <div className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold text-slate-500"><ProfileAvatar name={row.consultant} imageUrl={row.consultant_image_url} className="h-5 w-5" fallbackClassName="bg-slate-500" /><span className="truncate">{row.consultant}</span></div>}
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-slate-600">{new Date(row.scheduled_at).toLocaleString("en-GB")}</td>
              <td className="px-3 py-3"><span className={`inline-block rounded-full px-2 py-1 font-bold ${row.completed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{row.completed ? "Completed" : "Pending"}</span></td>
            </tr>)}</tbody>
          </table>
        </ListScrollArea>
      </div>

      {selected && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={() => setSelected(null)}>
        <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
          <div className="flex justify-between"><div><h2 className="text-lg font-black">{selected.name}</h2><p className="text-xs text-slate-500">{selected.mobile} · {selected.email}</p></div><button onClick={() => setSelected(null)}>✕</button></div>
          <div className="mt-4 space-y-3">
            {[["Basic Personal Information", selectedArrangement.personal], ["Follow-up Information", selectedArrangement.followup], ["Other Information", selectedArrangement.other]].map(([title, entries]) => entries.length > 0 && (
              <div key={title}><div className="mb-1.5 text-[9px] font-black uppercase tracking-wide text-slate-400">{title}</div><div className="grid gap-2 sm:grid-cols-2">
                {entries.map(([key, value]) => <div key={key} className="rounded-lg bg-slate-50 p-3"><div className="text-[10px] font-bold uppercase text-slate-400">{key}</div><div className="mt-1 break-words text-xs font-semibold text-slate-700">{key.toLowerCase().includes("date") ? new Date(value).toLocaleString("en-GB") : typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}</div></div>)}
              </div></div>
            ))}
          </div>
          <button onClick={() => navigate(`/admin/customers/${selected.customer_id}`)} className="mt-4 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white">Open Guest Profile</button>
        </div>
      </div>}
      <style>{`.input{width:100%;border:1px solid #D0D5DD;border-radius:8px;padding:9px 10px;font-size:12px;outline:none;background:white}.input:focus{border-color:#2554C7;box-shadow:0 0 0 3px #EEF4FF}`}</style>
    </div>
  );
}
