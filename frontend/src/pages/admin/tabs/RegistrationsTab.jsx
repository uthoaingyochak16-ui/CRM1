import { useQuery, useQueryClient as useQueryGuest } from "@tanstack/react-query";
import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { listRegistrations, deleteRegistration, listFields, clearRegistrationCache } from "../../../api/guest.js";
import { arrangeDataEntries, arrangeDataKeys } from "../../../utils/dataArrangement.js";
import ListScrollArea from "../../../components/ListScrollArea.jsx";
import PeriodRangeFilter from "../../../components/PeriodRangeFilter.jsx";

function toCsvValue(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function RegistrationsTab({ projectId, regUrl }) {
  const queryGuest = useQueryGuest();
  const [selectedRow, setSelectedRow] = useState(null);
  const [dateRange, setDateRange] = useState({ dateFrom: "", dateTo: "" });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["registrations", projectId],
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const [r, f] = await Promise.all([
        listRegistrations(projectId),
        listFields(projectId)
      ]);
      return { rows: r.data, fields: f.data };
    },
  });

  const rows = data?.rows || [];
  const visibleRows = rows.filter((row) => {
    const date = row.created_at?.slice(0, 10) || "";
    return (!dateRange.dateFrom || date >= dateRange.dateFrom) && (!dateRange.dateTo || date <= dateRange.dateTo);
  });
  const fields = data?.fields || [];

  const columns = arrangeDataKeys(fields.length ? fields.map((f) => f.key) : rows[0] ? Object.keys(rows[0].data) : []);
  const labelFor = (key) => fields.find((f) => f.key === key)?.label || key;

  async function handleDelete(regId) {
    if (!confirm("এই registration মুছে ফেলবেন?")) return;
    await deleteRegistration(projectId, regId);
    clearRegistrationCache(projectId);
    queryGuest.invalidateQueries({ queryKey: ["registrations", projectId] });
  }

  function exportCsv() {
    const header = ["Registration ID", ...columns.map(labelFor), "Submitted At"];
    const lines = [header.map(toCsvValue).join(",")];
    visibleRows.forEach((r) => {
      const line = [
        r.reg_id,
        ...columns.map((c) => r.data[c] ?? ""),
        new Date(r.created_at).toLocaleString("bn-BD"),
      ];
      lines.push(line.map(toCsvValue).join(","));
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "registrations.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const headers = ["Registration ID", ...columns.map(labelFor), "Submitted At"];
    const body = visibleRows.map((row) => [
      row.reg_id,
      ...columns.map((column) => String(row.data[column] ?? "")),
      new Date(row.created_at).toLocaleString("en-GB"),
    ]);
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(15);
    doc.setFont(undefined, "bold");
    doc.text("Event Registrations", 32, 34);
    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    doc.setTextColor(100);
    doc.text(`Exported: ${new Date().toLocaleString("en-GB")}  |  ${body.length} registrations`, 32, 50);
    autoTable(doc, {
      head: [headers],
      body,
      startY: 64,
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 3, overflow: "linebreak", valign: "middle" },
      headStyles: { fillColor: [37, 84, 199], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 24, right: 24 },
      horizontalPageBreak: true,
      horizontalPageBreakRepeat: 0,
    });
    doc.save(`event-${projectId}-registrations.pdf`);
  }

  if (isLoading) return (
    <div className="rounded-xl border border-[#E4E7EC] bg-white p-5">
      <div className="animate-pulse space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-[#F1F2F4] rounded-lg" />
        ))}
      </div>
    </div>
  );

  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-[#101828]">
            Registrations ({visibleRows.length})
            {isFetching && <span className="ml-2 text-xs font-normal text-[#98A2B3]">আপডেট হচ্ছে…</span>}
          </div>
          <a href={regUrl} target="_blank" rel="noreferrer" className="text-[11px] text-[#98A2B3] hover:text-[#2554C7] hover:underline">
            {regUrl}
          </a>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
        <PeriodRangeFilter onChange={setDateRange} />
        <button
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="rounded-full border border-[#D0D5DD] px-4 py-2 text-xs font-semibold text-[#344054] hover:border-[#2554C7] hover:text-[#2554C7] disabled:opacity-40"
        >
          Export CSV
        </button>
        <button
          onClick={exportPdf}
          disabled={visibleRows.length === 0}
          className="rounded-full bg-[#2554C7] px-4 py-2 text-xs font-semibold text-white hover:bg-[#17368F] disabled:opacity-40"
        >
          Download PDF
        </button>
        </div>
      </div>

      {visibleRows.length === 0 ? (
        <div className="py-14 text-center text-xs text-[#98A2B3]">এখনো কোনো registration আসেনি।</div>
      ) : (
        <ListScrollArea>
          <table
            className="w-full table-auto border-collapse text-left text-xs"
            style={{ minWidth: `${Math.max(720, (columns.length + 3) * 140)}px` }}
          >
            <thead>
              <tr className="border-b border-[#E4E7EC] bg-[#F9FAFB] text-[#667085]">
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">SI</th>
                {columns.map((c) => (
                  <th key={c} className="whitespace-nowrap px-3 py-2.5 font-semibold">{labelFor(c)}</th>
                ))}
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">Submitted</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r, i) => (
                <tr key={r.id} onClick={() => setSelectedRow(r)} className={`cursor-pointer border-b border-[#F1F2F4] transition-colors hover:bg-[#EEF4FF]/40 ${i % 2 === 0 ? "bg-[#EAF2FF]" : "bg-white"}`}>
                  <td className="whitespace-nowrap border-r border-[#F1F2F4] px-3 py-2.5 font-mono text-[11px] font-bold text-[#2554C7]">{i + 1}</td>
                  {columns.map((c) => (
                    <td key={c} title={String(r.data[c] || "")} className="max-w-[180px] truncate border-r border-[#F1F2F4] px-3 py-2.5 text-[#344054]">{r.data[c] || "—"}</td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2.5 text-[#98A2B3]">
                    {new Date(r.created_at).toLocaleString("bn-BD")}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button onClick={(event) => { event.stopPropagation(); handleDelete(r.id); }} className="text-[#D92D20] hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ListScrollArea>
      )}
      {selectedRow && <CompactDataModal title={selectedRow.reg_id} data={selectedRow.data} onClose={() => setSelectedRow(null)} />}
    </div>
  );
}

function CompactDataModal({ title, data, onClose }) {
  const arranged = arrangeDataEntries(data || {});
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={onClose}>
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-base font-black text-slate-900">{title}</h3><button onClick={onClose} className="rounded-full border px-3 py-1 text-xs font-bold">Close</button></div>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {[...arranged.personal, ...arranged.followup, ...arranged.other].map(([key, value]) => <div key={key} className="rounded-lg bg-slate-50 px-2.5 py-1.5"><div className="text-[8px] font-bold uppercase text-slate-400">{key.replace(/_/g, " ")}</div><div className="break-words text-[11px] font-semibold text-slate-700">{typeof value === "object" ? JSON.stringify(value) : String(value)}</div></div>)}
        </div>
      </div>
    </div>
  );
}
