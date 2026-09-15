// frontend/src/pages/admin/MyPerformancePage.jsx — new file (executive self-view)
import { useEffect, useState } from "react";
import { getPerfSummary, getPerfTrend, getStageBreakdown } from "../../api/guest.js";
import PerformanceDocumentationModal from "../../components/PerformanceDocumentationModal.jsx";
import PerformanceCharts from "../../components/PerformanceCharts.jsx";
import PerformancePeriodFilter, { defaultAnchor, performanceRangeParams } from "../../components/PerformancePeriodFilter.jsx";
import { useRealtimeRefresh } from "../../realtime/RealtimeContext.jsx";
import StagePerformanceChart from "../../components/StagePerformanceChart.jsx";

export default function MyPerformancePage({ onLoggedOut }) {
  const [period, setPeriod] = useState("weekly");
  const [anchor, setAnchor] = useState(() => defaultAnchor("weekly"));
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [showDocumentation, setShowDocumentation] = useState(false);
  const [stageData, setStageData] = useState(null);

  useEffect(() => {
    const params = performanceRangeParams(period, anchor);
    getPerfSummary(params).then((r) => setSummary(r.data)).catch((err) => { if (err.response?.status === 401) onLoggedOut(); });
    getPerfTrend({ start: params.start, end: params.end }).then((r) => setTrend(r.data)).catch(() => {});
    getStageBreakdown(params).then((r) => setStageData(r.data)).catch(() => {});
  }, [period, anchor, onLoggedOut]);

  useRealtimeRefresh(
    ["tasks", "call_logs", "customer_communications", "executive_targets", "admin_performance_feedback"],
    () => {
      const params = performanceRangeParams(period, anchor);
      getPerfSummary(params).then((r) => setSummary(r.data));
      getPerfTrend({ start: params.start, end: params.end }).then((r) => setTrend(r.data));
    },
  );

  if (!summary) return <div className="p-10 text-center text-sm text-[#667085]">লোড হচ্ছে…</div>;

  return (
    <div className="mx-auto max-w-6xl px-3 py-3">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-xl font-black text-[#101828]"> Performance</h1>
        <div className="flex items-center">
          <PerformancePeriodFilter
            period={period}
            anchor={anchor}
            allowedPeriods={["daily", "weekly", "monthly", "yearly"]}
            onChange={(nextPeriod, nextAnchor) => {
              setPeriod(nextPeriod);
              setAnchor(nextAnchor);
            }}
          />
        </div>
        <button onClick={() => setShowDocumentation(true)} className="ml-auto rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-xs font-semibold text-[#344054] hover:border-[#2554C7] hover:text-[#2554C7]">
          Documentation
        </button>
      </div>

      <PerformanceCharts summary={summary} trend={trend} />
      <StagePerformanceChart data={stageData} title=" Guest Stage Breakdown" />

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <Stat label="Score" value={summary.performance_score} sub={summary.performance_category} />
        <Stat label="Points" value={`${stageData?.points_earned ?? summary.total_points} / ${stageData?.points_possible ?? 100}`} />
        <Stat label="Communications" value={summary.total_contacted} />
        <Stat label="Interested" value={summary.interested} />
        <Stat label="Follow-ups Done" value={`${summary.followup_completion_rate}%`} />
        <Stat label="Active Hours" value={summary.active_hours} />
        <Stat label="Completed Tasks" value={summary.completed_tasks} />
        <Stat label="Joined" value={summary.joined} />
      </div>

      <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 text-xs text-[#667085]">
        নিজের performance-এর বিস্তারিত history দেখতে admin-এর সাথে যোগাযোগ করুন। শুধু নিজের data এখানে দেখা যায় — অন্য কোনো communicator-এর তথ্য এখানে অ্যাকসেস করা যায় না।
      </div>

      <PerformanceDocumentationModal open={showDocumentation} onClose={() => setShowDocumentation(false)} />
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2.5">
      <div className="font-display text-lg font-black text-[#2554C7]">{value}</div>
      <div className="mt-1 text-[11px] font-semibold text-[#667085]">{label}{sub ? ` · ${sub}` : ""}</div>
    </div>
  );
}
