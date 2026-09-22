// frontend/src/pages/admin/PerformancePage.jsx â€” new file (admin leaderboard)
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getLeaderboard } from "../../api/guest.js";
import { useRealtimeRefresh } from "../../realtime/realtimeHooks.js";
import PerformanceDocumentationModal from "../../components/PerformanceDocumentationModal.jsx";
import PerformancePeriodFilter from "../../components/PerformancePeriodFilter.jsx";
import { defaultAnchor, performanceRangeParams } from "../../components/performancePeriodUtils.js";
import ListScrollArea from "../../components/ListScrollArea.jsx";

const STATUS_COLOR = {
  online: "bg-emerald-600 text-white ring-emerald-700",
  idle: "bg-amber-500 text-white ring-amber-600",
  offline: "bg-slate-600 text-white ring-slate-700",
};
const CATEGORY_COLOR = {
  Excellent: "bg-[#ECFDF3] text-[#027A48]", "Very Good": "bg-[#EEF4FF] text-[#17368F]",
  Good: "bg-[#FFFBEB] text-[#B45309]", "Needs Improvement": "bg-[#FEF3F2] text-[#D92D20]", Poor: "bg-[#FEF3F2] text-[#D92D20]",
};

export default function PerformancePage({ onLoggedOut }) {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("weekly");
  const [anchor, setAnchor] = useState(() => defaultAnchor("weekly"));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState("performance_score");
  const [showDocumentation, setShowDocumentation] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadLeaderboard = (showLoading = false) => {
      if (showLoading) setLoading(true);
      getLeaderboard(performanceRangeParams(period, anchor))
        .then((res) => {
          if (!cancelled) setRows(res.data);
        })
        .catch((err) => {
          if (!cancelled && err.response?.status === 401) onLoggedOut();
        })
        .finally(() => {
          if (!cancelled && showLoading) setLoading(false);
        });
    };

    loadLeaderboard(true);
    const refreshInterval = setInterval(() => loadLeaderboard(false), 15000);
    return () => {
      cancelled = true;
      clearInterval(refreshInterval);
    };
  }, [period, anchor, onLoggedOut]);

  useRealtimeRefresh(
    ["tasks", "users", "call_logs", "customer_communications", "executive_targets", "admin_performance_feedback"],
    () => {
      getLeaderboard(performanceRangeParams(period, anchor))
        .then((res) => setRows(res.data));
    },
  );

  const presenceRows = rows;
  const sorted = [...presenceRows].sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));

  const totals = {
    online: presenceRows.filter((r) => r.status === "online").length,
    idle: presenceRows.filter((r) => r.status === "idle").length,
    offline: presenceRows.filter((r) => r.status === "offline").length,
    avgScore: rows.length ? (rows.reduce((s, r) => s + r.performance_score, 0) / rows.length).toFixed(1) : 0,
  };

  return (
    <div className="w-full max-w-none px-2 py-3">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-black text-[#101828]">Communicator Performance</h1>
          <p className="text-xs text-[#667085]">à¦ªà§à¦°à¦¤à¦¿à¦Ÿà¦¾ communicator-à¦à¦° activity, communication à¦à¦¬à¦‚ conversion track à¦•à¦°à§à¦¨à¥¤</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowDocumentation(true)} className="rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-xs font-semibold text-[#344054] hover:border-[#2554C7] hover:text-[#2554C7]">
            Documentation
          </button>
          <PerformancePeriodFilter
            period={period}
            anchor={anchor}
            onChange={(nextPeriod, nextAnchor) => {
              setPeriod(nextPeriod);
              setAnchor(nextAnchor);
            }}
          />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Online" value={totals.online} color="text-[#027A48]" />
        <StatCard label="Idle" value={totals.idle} color="text-[#B45309]" />
        <StatCard label="Offline" value={totals.offline} color="text-[#667085]" />
        <StatCard label="Avg Score" value={totals.avgScore} color="text-[#2554C7]" />
      </div>

      {loading && <div className="py-10 text-center text-sm text-[#667085]">à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡â€¦</div>}
      {!loading && rows.length === 0 && <div className="rounded-xl border border-[#E4E7EC] bg-white py-14 text-center text-sm text-[#98A2B3]">à¦•à§‹à¦¨à§‹ communicator à¦¨à§‡à¦‡à¥¤</div>}

      {!loading && rows.length > 0 && (
        <ListScrollArea className="rounded-xl border border-[#E4E7EC] bg-white">
          <table className="w-full min-w-0 table-fixed border-collapse text-xs">
            <colgroup>
              <col className="w-[18%]" />
              <col className="w-[12%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[7%]" />
              <col className="w-[7%]" />
              <col className="w-[9%]" />
              <col className="w-[11%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-[#E4E7EC] bg-slate-50 text-xs text-[#667085]">
                <th className="px-2 py-3 text-left font-semibold">Communicator</th>
                <th className="px-2 py-3 text-left font-semibold">Status</th>
                <th className="px-2 py-3 text-left font-semibold cursor-pointer" onClick={() => setSortKey("active_hours")}>Active Hrs</th>
                <th className="px-2 py-3 text-left font-semibold cursor-pointer" onClick={() => setSortKey("total_contacted")}>Contacted</th>
                <th className="px-2 py-3 text-left font-semibold">Interested</th>
                <th className="px-2 py-3 text-left font-semibold">Joined</th>
                <th className="px-2 py-3 text-left font-semibold">Graduated</th>
                <th className="px-2 py-3 text-left font-semibold cursor-pointer" onClick={() => setSortKey("total_points")}>Points</th>
                <th className="px-2 py-3 text-left font-semibold cursor-pointer" onClick={() => setSortKey("performance_score")}>Score</th>
                <th className="px-2 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.user_id} onClick={() => navigate(`/admin/performance/${r.user_id}`)} className="cursor-pointer border-b border-[#F1F2F4] hover:bg-slate-50/60 last:border-none">
                  <td className="truncate px-2 py-3 font-semibold text-[#101828]" title={r.name}>{r.name}</td>
                  <td className="px-2 py-3 text-left">
                    {r.status === "online" ? (
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold shadow-sm ring-1 ring-inset ${STATUS_COLOR.online}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-white" /> Active
                      </span>
                    ) : (
                      <div>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLOR.offline}`}>Offline</span>
                        <div className="mt-1 truncate text-[9px] text-[#667085]" title={r.last_active ? new Date(r.last_active).toLocaleString("en-GB") : ""}>
                          Last active: {r.last_active ? new Date(r.last_active).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }) : "â€”"}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-3 text-[#344054]">{r.active_hours}</td>
                  <td className="px-2 py-3 text-[#344054]">{r.total_contacted}</td>
                  <td className="px-2 py-3 text-[#344054]">{r.interested}</td>
                  <td className="px-2 py-3 text-[#344054]">{r.joined}</td>
                  <td className="px-2 py-3 text-[#344054]">{r.graduated}</td>
                  <td className="px-2 py-3 font-semibold text-[#2554C7]">{r.total_points}</td>
                  <td className="px-2 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${CATEGORY_COLOR[r.performance_category]}`}>
                      {r.performance_score} Â· {r.performance_category}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-right">
                    <button onClick={() => navigate(`/admin/performance/${r.user_id}`)} className="rounded-lg bg-[#EEF4FF] px-2 py-1.5 text-[10px] font-bold text-[#17368F] hover:bg-[#DBEAFE]">
                      Details â†’
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ListScrollArea>
      )}

      <PerformanceDocumentationModal open={showDocumentation} onClose={() => setShowDocumentation(false)} canEdit />
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
      <div className={`font-display text-2xl font-black ${color}`}>{value}</div>
      <div className="mt-1 text-[11px] font-semibold text-[#667085]">{label}</div>
    </div>
  );
}
