import { useCallback, useEffect, useState } from "react";
import { getDashboardOverview } from "../../api/guest.js";
import { useRealtimeRefresh } from "../../realtime/realtimeHooks.js";

export default function DashboardPage({ onLoggedOut }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [stageReportDate, setStageReportDate] = useState(() => new Date().toLocaleDateString("en-CA"));

  const load = useCallback(() => {
    getDashboardOverview({ report_date: stageReportDate })
      .then((res) => setData(res.data))
      .catch((err) => {
        if (err.response?.status === 401) onLoggedOut();
        else setError("Dashboard à¦²à§‹à¦¡ à¦•à¦°à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤");
      });
  }, [onLoggedOut, stageReportDate]);

  useEffect(load, [load]);
  useRealtimeRefresh(["projects", "registrations", "tasks", "users"], load);

  if (error) return <div className="mx-auto max-w-3xl px-5 py-14 text-center text-sm text-[#D92D20]">{error}</div>;
  if (!data) return <div className="mx-auto max-w-3xl px-5 py-14 text-center text-sm text-[#667085]">à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡â€¦</div>;

  return (
    <div className="w-full max-w-none px-2 py-3">
      <div className="mb-6">
        <div>
        <h1 className="font-display text-xl font-black text-[#101828]">Overview</h1>
        <p className="text-xs text-[#667085]">
          à¦—à¦¤à¦•à¦¾à¦² ({data.yesterday_date}) à¦“ à¦†à¦œà¦•à§‡à¦° ({data.today_date}) à¦•à¦¾à¦°à§à¦¯à¦•à§à¦°à¦®à§‡à¦° à¦¸à¦¾à¦°à¦¸à¦‚à¦•à§à¦·à§‡à¦ªà¥¤
        </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="à¦—à¦¤à¦•à¦¾à¦² à¦¨à¦¤à§à¦¨ Registration" value={data.totals.registrations_yesterday} accent />
        <StatCard label="à¦†à¦œ à¦¨à¦¤à§à¦¨ Registration" value={data.totals.registrations_today} />
        <StatCard label="Task Pending" value={data.totals.tasks_pending} warn />
        <StatCard label="Task Completed" value={data.totals.tasks_completed} good />
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <LeadBreakdownCard title="à¦†à¦œà¦•à§‡à¦° à¦¨à¦¤à§à¦¨ Lead" data={data.today_leads} />
        <LeadBreakdownCard title="à¦†à¦—à§‡à¦° à¦¦à¦¿à¦¨à§‡à¦° à¦¨à¦¤à§à¦¨ Lead" data={data.yesterday_leads} />
      </div>
      <div className="mb-3 flex justify-end">
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
          Stage report date
          <input type="date" value={stageReportDate} onChange={(event) => setStageReportDate(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:border-blue-500" />
        </label>
      </div>
      <TodayTaskStageSummary date={data.stage_report_date} stages={data.today_stage_summary} conversions={data.today_stage_conversions} />
      <Section title="à¦ªà§à¦°à§‹à¦—à§à¦°à¦¾à¦®-à¦­à¦¿à¦¤à§à¦¤à¦¿à¦• Registration">
        {data.projects.length === 0 ? (
          <Empty text="à¦à¦–à¦¨à§‹ à¦•à§‹à¦¨à§‹ Event à¦¨à§‡à¦‡à¥¤" />
        ) : (
          <Table
            head={["Program", "à¦—à¦¤à¦•à¦¾à¦²", "à¦†à¦œ", "à¦®à§‹à¦Ÿ"]}
            rows={data.projects.map((p) => [p.project_name, p.registrations_yesterday, p.registrations_today, p.registrations_total])}
          />
        )}
      </Section>

      <Section title="Communicator-à¦­à¦¿à¦¤à§à¦¤à¦¿à¦• Task Activity">
        {data.executives.length === 0 ? (
          <Empty text="à¦à¦–à¦¨à§‹ à¦•à§‹à¦¨à§‹ Communicator à¦…à§à¦¯à¦¾à¦•à¦¾à¦‰à¦¨à§à¦Ÿ à¦¤à§ˆà¦°à¦¿ à¦¹à¦¯à¦¼à¦¨à¦¿à¥¤" />
        ) : (
          <Table
            head={["Communicator", "à¦—à¦¤à¦•à¦¾à¦² Complete à¦•à¦°à§‡à¦›à§‡", "à¦®à§‹à¦Ÿ Complete", "à¦à¦–à¦¨à§‹ Pending"]}
            rows={data.executives.map((e) => [e.name, e.tasks_completed_yesterday, e.tasks_completed_total, e.tasks_pending])}
          />
        )}
      </Section>

    </div>
  );
}

function TodayTaskStageSummary({ date, stages = [], conversions = [] }) {
  const total = stages.reduce((sum, item) => sum + item.count, 0);
  return (
    <Section title={`${date || ""} â€” Communicator Task Stage Summary`}>
      <div className="mb-4 flex items-center justify-between rounded-xl bg-indigo-50 px-4 py-3">
        <span className="text-xs font-bold text-indigo-800">à¦®à§‹à¦Ÿ completed contact</span>
        <span className="text-2xl font-extrabold tracking-[0.02em] text-indigo-700">{total}</span>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <BreakdownList title="Stage count" rows={stages.map((item) => ({ name: item.stage, count: item.count }))} />
        <BreakdownList title="Stage conversion" rows={conversions.map((item) => ({ name: `${item.from_stage} â†’ ${item.to_stage}`, count: item.count }))} />
      </div>
    </Section>
  );
}

function StatCard({ label, value, accent, warn, good }) {
  const color = warn ? "text-[#B45309]" : good ? "text-[#027A48]" : accent ? "text-[#2554C7]" : "text-[#101828]";
  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
      <div className={`text-3xl font-extrabold tracking-[0.02em] ${color}`}>{value}</div>
      <div className="mt-1 text-[11px] font-semibold text-[#667085]">{label}</div>
    </div>
  );
}

function LeadBreakdownCard({ title, data }) {
  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-black text-[#101828]">{title}</div>
          <div className="mt-0.5 text-[11px] text-[#667085]">{data?.date || "â€”"}</div>
        </div>
        <div className="rounded-xl bg-blue-50 px-4 py-2 text-center">
          <div className="text-2xl font-extrabold tracking-[0.02em] text-blue-700">{data?.total || 0}</div>
          <div className="text-[9px] font-bold uppercase text-blue-600">Total Lead</div>
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <BreakdownList title="Lead Source" rows={data?.sources || []} />
        <BreakdownList title="Current Stage" rows={data?.stages || []} />
      </div>
    </div>
  );
}

function BreakdownList({ title, rows }) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-[#667085]">{title}</div>
      <div className="space-y-1.5">
        {rows.length ? rows.map((row) => (
          <div key={row.name} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs">
            <span className="truncate font-semibold text-slate-700">{row.name}</span>
            <span className="rounded-full bg-white px-2 py-0.5 font-extrabold tracking-[0.02em] text-blue-700">{row.count}</span>
          </div>
        )) : <div className="rounded-lg bg-slate-50 px-3 py-4 text-center text-[11px] text-slate-400">à¦•à§‹à¦¨à§‹ lead à¦¨à§‡à¦‡</div>}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-6 rounded-xl border border-[#E4E7EC] bg-white p-5">
      <div className="mb-3 text-sm font-bold text-[#101828]">{title}</div>
      {children}
    </div>
  );
}

function Table({ head, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-0 table-fixed border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-[#E4E7EC] text-[#667085]">
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap py-2 pr-4 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[#F1F2F4] last:border-none">
              {row.map((cell, j) => (
                <td key={j} className={`whitespace-nowrap py-2 pr-4 ${j === 0 ? "font-semibold text-[#101828]" : "text-[#344054]"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ text }) {
  return <div className="py-6 text-center text-xs text-[#98A2B3]">{text}</div>;
}
