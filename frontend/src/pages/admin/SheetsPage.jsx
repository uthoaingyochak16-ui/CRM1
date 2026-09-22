// frontend/src/pages/admin/SheetsPage.jsx
import { useEffect, useMemo, useState } from "react";
import { listProjects, listRegistrations } from "../../api/guest";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useRealtimeRefresh } from "../../realtime/realtimeHooks.js";
import { arrangeDataEntries, arrangeDataKeys } from "../../utils/dataArrangement.js";
import ListScrollArea from "../../components/ListScrollArea.jsx";
import PeriodRangeFilter from "../../components/PeriodRangeFilter.jsx";

export default function SheetsPage({ onLoggedOut }) {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [sortKey, setSortKey] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [visibleCols, setVisibleCols] = useState(new Set());
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);

  useEffect(() => {
    listProjects()
      .then((res) => setProjects(res.data))
      .catch((err) => {
        if (err.response?.status === 401) onLoggedOut();
        else setError("à¦²à§‹à¦¡ à¦•à¦°à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useRealtimeRefresh(["projects", "project_permissions"], () => {
    listProjects().then((res) => setProjects(res.data));
  });
  useRealtimeRefresh(["registrations", "form_fields"], () => {
    if (selectedProject) selectProject(selectedProject);
  });

  function selectProject(project) {
    setSelectedProject(project);
    setLoading(true);
    setRegistrations([]);
    setFields([]);
    setSearchQuery("");
    setDateFrom(""); setDateTo("");
    setSortKey("date"); setSortDir("desc");
    listRegistrations(project.id)
      .then((res) => {
        const regs = res.data;
        setRegistrations(regs);
        if (regs.length > 0) {
          const allKeys = new Set();
          regs.forEach((r) => Object.keys(r.data || {}).forEach((k) => allKeys.add(k)));
          const keys = arrangeDataKeys([...allKeys]);
          setFields(keys);
          setVisibleCols(new Set(["date", ...keys]));
        } else {
          setFields([]);
          setVisibleCols(new Set(["date"]));
        }
      })
      .catch(() => setError("Registration à¦²à§‹à¦¡ à¦•à¦°à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤"))
      .finally(() => setLoading(false));
  }

  const processed = useMemo(() => {
    let rows = registrations.filter((r) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesText =
          (r.reg_id && r.reg_id.toLowerCase().includes(q)) ||
          (r.created_at && new Date(r.created_at).toLocaleDateString("en-GB").toLowerCase().includes(q)) ||
          Object.values(r.data || {}).some((val) => String(val).toLowerCase().includes(q));
        if (!matchesText) return false;
      }
      if (dateFrom) {
        const d = new Date(r.created_at); d.setHours(0,0,0,0);
        const from = new Date(dateFrom); from.setHours(0,0,0,0);
        if (d < from) return false;
      }
      if (dateTo) {
        const d = new Date(r.created_at); d.setHours(0,0,0,0);
        const to = new Date(dateTo); to.setHours(0,0,0,0);
        if (d > to) return false;
      }
      return true;
    });

    rows = [...rows].sort((a, b) => {
      let av, bv;
      if (sortKey === "date") { av = new Date(a.created_at).getTime(); bv = new Date(b.created_at).getTime(); }
      else if (sortKey === "reg_id") { av = a.reg_id || ""; bv = b.reg_id || ""; }
      else { av = a.data?.[sortKey] ?? ""; bv = b.data?.[sortKey] ?? ""; }
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      av = String(av).toLowerCase(); bv = String(bv).toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return rows;
  }, [registrations, searchQuery, dateFrom, dateTo, sortKey, sortDir]);

  const activeFields = fields.filter((f) => visibleCols.has(f));
  const showDate = visibleCols.has("date");
  const sortOptions = useMemo(() => [
    { value: "date", label: "Date" },
    { value: "reg_id", label: "SI No" },
    ...fields.map((f) => ({ value: f, label: f.replace(/_/g, " ") })),
  ], [fields]);

  function toggleCol(key) {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  function handleSortFieldChange(key) {
    setSortKey(key);
    setSortDir("asc");
  }

  function toggleSortDirection() {
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }

  function buildExportData() {
    const headers = ["SI"];
    if (showDate) headers.push("Date");
    activeFields.forEach((f) => headers.push(f.replace(/_/g, " ")));

    const rows = processed.map((r, index) => {
      const row = [index + 1];
      if (showDate) row.push(new Date(r.created_at).toLocaleDateString("en-GB"));
      activeFields.forEach((f) => row.push(String(r.data?.[f] ?? "")));
      return row;
    });
    return { headers, rows };
  }

  function downloadCSV() {
    const { headers, rows } = buildExportData();
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedProject?.name || "registrations"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadPDF() {
    const { headers, rows } = buildExportData();
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

    doc.setFontSize(14);
    doc.setFont(undefined, "bold");
    doc.text(selectedProject?.name || "Registrations", 40, 40);
    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    doc.setTextColor(120);
    doc.text(`Exported: ${new Date().toLocaleString("en-GB")}  â€¢  ${rows.length} records`, 40, 56);

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 72,
      styles: { fontSize: 8, cellPadding: 5 },
      headStyles: { fillColor: [37, 84, 199], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 40, right: 40 },
    });

    doc.save(`${selectedProject?.name || "registrations"}.pdf`);
  }

  return (
    <div className="w-full max-w-none px-2 py-3">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          {selectedProject && (
            <button
              onClick={() => setSelectedProject(null)}
              className="back-button mb-2"
            >
              â† All Sheets
            </button>
          )}
          <h1 className="font-display text-2xl font-black text-[#101828]">
            {selectedProject ? selectedProject.name : ""}
          </h1>
          {selectedProject && (
            <p className="mt-0.5 text-xs text-[#98A2B3]">
              {processed.length} / {registrations.length} registration{registrations.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {selectedProject && registrations.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={downloadCSV}
              className="flex items-center gap-1.5 rounded-full border border-[#D0D5DD] bg-white px-4 py-2.5 text-xs font-bold text-[#344054] hover:border-[#2554C7] hover:text-[#2554C7]"
            >
              â¬‡ CSV
            </button>
            <button
              onClick={downloadPDF}
              className="flex items-center gap-1.5 rounded-full bg-[#2554C7] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#17368F]"
            >
              â¬‡ PDF
            </button>
          </div>
        )}
      </div>

      {error && <div className="mb-4 rounded-lg bg-[#FEF3F2] px-4 py-3 text-xs text-[#D92D20]">{error}</div>}

      {!selectedProject ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => selectProject(p)}
              className="group relative overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#2554C7] hover:shadow-md"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF] text-lg">
                ðŸ“Š
              </div>
              <div className="truncate text-sm font-bold text-[#101828] group-hover:text-[#2554C7]">{p.name}</div>
              <div className="mt-1 flex items-center gap-1 text-xs text-[#667085]">
                <span className="font-semibold text-[#2554C7]">{p.registrations_count}</span> registrations
              </div>
            </button>
          ))}
          {projects.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-[#D0D5DD] bg-white py-14 text-center text-sm text-[#98A2B3]">
              à¦•à§‹à¦¨à§‹ event à¦ªà¦¾à¦“à¦¯à¦¼à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* Toolbar */}
          {registrations.length > 0 && (
            <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-[#E4E7EC] bg-white p-4 shadow-sm md:flex-row md:items-center md:flex-wrap">
              <div className="relative min-w-[220px] flex-1">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#98A2B3]">ðŸ”</span>
                <input
                  type="text"
                  placeholder="Search by Reg ID, name, phone, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-[#E4E7EC] bg-[#FAFBFC] py-2.5 pl-9 pr-3 text-xs outline-none focus:border-[#2554C7] focus:bg-white focus:ring-2 focus:ring-[#EEF4FF]"
                />
              </div>

              <PeriodRangeFilter onChange={(range) => { setDateFrom(range.dateFrom); setDateTo(range.dateTo); }} />

              <div className="flex items-center gap-2">
                <select
                  value={sortKey}
                  onChange={(e) => handleSortFieldChange(e.target.value)}
                  className="rounded-lg border border-[#E4E7EC] bg-[#FAFBFC] px-3 py-2 text-xs font-semibold text-[#344054] outline-none focus:border-[#2554C7] focus:bg-white"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <button
                  onClick={toggleSortDirection}
                  className="rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs font-semibold text-[#344054] hover:border-[#2554C7] hover:text-[#2554C7]"
                >
                  {sortDir === "asc" ? "Aâ†’Z" : "Zâ†’A"}
                </button>
              </div>

              <div className="relative">
                <button
                  onClick={() => setColPickerOpen((o) => !o)}
                  className="flex items-center gap-1.5 rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs font-semibold text-[#344054] hover:border-[#2554C7] hover:text-[#2554C7]"
                >
                  âš™ Columns ({activeFields.length + (showDate ? 1 : 0) + 1})
                </button>
                {colPickerOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setColPickerOpen(false)} />
                    <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-[#E4E7EC] bg-white p-2 shadow-lg">
                      <label className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs hover:bg-[#F9FAFB]">
                        <input type="checkbox" checked={showDate} onChange={() => toggleCol("date")} />
                        Date
                      </label>
                      <div className="my-1 border-t border-[#F1F2F4]" />
                      {fields.map((f) => (
                        <label key={f} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs capitalize hover:bg-[#F9FAFB]">
                          <input type="checkbox" checked={visibleCols.has(f)} onChange={() => toggleCol(f)} />
                          {f.replace(/_/g, " ")}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {(searchQuery || dateFrom || dateTo) && (
                <button
                  onClick={() => { setSearchQuery(""); setDateFrom(""); setDateTo(""); }}
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-[#D92D20] hover:bg-[#FEF3F2]"
                >
                  Reset
                </button>
              )}
            </div>
          )}

          {loading && <div className="py-10 text-center text-sm text-[#667085]">à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡â€¦</div>}

          {!loading && registrations.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#D0D5DD] bg-white py-16 text-center text-sm text-[#98A2B3]">
              à¦à¦‡ program à¦ à¦•à§‹à¦¨à§‹ registration à¦¨à§‡à¦‡à¥¤
            </div>
          )}

          {!loading && registrations.length > 0 && processed.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#D0D5DD] bg-white py-16 text-center text-sm text-[#98A2B3]">
              à¦•à§‹à¦¨à§‹ à¦«à¦²à¦¾à¦«à¦² à¦ªà¦¾à¦“à¦¯à¦¼à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿ â€” filter à¦ªà¦°à¦¿à¦¬à¦°à§à¦¤à¦¨ à¦•à¦°à§‡ à¦¦à§‡à¦–à§à¦¨à¥¤
            </div>
          )}

          {!loading && processed.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-sm">
              <ListScrollArea>
                <table className="w-max min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#E4E7EC] bg-gradient-to-b from-[#F9FAFB] to-[#F3F4F6]">
                      <th className="whitespace-nowrap px-4 py-3 text-left font-bold text-[#98A2B3]">SI</th>
                      {showDate && (
                        <SortableTh label="Date" active={sortKey==="date"} dir={sortDir} onClick={() => handleSort("date")} />
                      )}
                      {activeFields.map((f) => (
                        <SortableTh key={f} label={f.replace(/_/g, " ")} active={sortKey===f} dir={sortDir} onClick={() => handleSort(f)} capitalize />
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {processed.map((r, i) => (
                      <tr key={r.id} onClick={() => setSelectedRow(r)} className={`cursor-pointer border-b border-[#F1F2F4] transition-colors hover:bg-[#EEF4FF]/40 ${i % 2 === 0 ? "bg-[#EAF2FF]" : "bg-white"}`}>
                        <td className="whitespace-nowrap px-4 py-3 text-[#98A2B3]">
                          <span className="rounded-md bg-[#EAF2FF] px-2 py-1 font-mono text-[11px] font-bold text-[#2554C7]">
                            {i + 1}
                          </span>
                        </td>
                        {showDate && (
                          <td className="whitespace-nowrap px-4 py-3 text-[#667085]">
                            {new Date(r.created_at).toLocaleDateString("en-GB")}
                          </td>
                        )}
                        {activeFields.map((f) => (
                          <td key={f} className="max-w-[220px] truncate px-4 py-3 text-[#344054]">{r.data?.[f] ?? "â€”"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ListScrollArea>
              <div className="flex items-center justify-between border-t border-[#F1F2F4] bg-[#FAFBFC] px-4 py-2.5 text-[10px] text-[#98A2B3]">
                <span>à¦¦à§‡à¦–à¦¾à¦šà§à¦›à§‡ {processed.length} / à¦®à§‹à¦Ÿ {registrations.length} à¦Ÿà¦¿ registration</span>
                <span>Sorted by <b className="text-[#667085]">{sortKey === "reg_id" ? "Reg ID" : sortKey === "date" ? "Date" : sortKey.replace(/_/g," ")}</b> ({sortDir === "asc" ? "Aâ†’Z" : "Zâ†’A"})</span>
              </div>
            </div>
          )}
          {selectedRow && <SheetDataModal row={selectedRow} onClose={() => setSelectedRow(null)} />}
        </div>
      )}
    </div>
  );
}

function SheetDataModal({ row, onClose }) {
  const arranged = arrangeDataEntries(row.data || {});
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={onClose}>
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><div><h3 className="font-black text-slate-900">{row.reg_id}</h3><p className="text-[10px] text-slate-400">{new Date(row.created_at).toLocaleString("en-GB")}</p></div><button onClick={onClose} className="rounded-full border px-3 py-1 text-xs font-bold">Close</button></div>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {[...arranged.personal, ...arranged.followup, ...arranged.other].map(([key, value]) => <div key={key} className="rounded-lg bg-slate-50 px-2.5 py-1.5"><div className="text-[8px] font-bold uppercase text-slate-400">{key.replace(/_/g, " ")}</div><div className="break-words text-[11px] font-semibold text-slate-700">{typeof value === "object" ? JSON.stringify(value) : String(value)}</div></div>)}
        </div>
      </div>
    </div>
  );
}

function SortableTh({ label, active, dir, onClick, capitalize }) {
  return (
    <th
      onClick={onClick}
      className={`cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left font-bold transition-colors ${capitalize ? "capitalize" : ""} ${active ? "text-[#2554C7]" : "text-[#344054] hover:text-[#2554C7]"}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`text-[9px] ${active ? "opacity-100" : "opacity-30"}`}>
          {active ? (dir === "asc" ? "â–²" : "â–¼") : "â‡…"}
        </span>
      </span>
    </th>
  );
}
