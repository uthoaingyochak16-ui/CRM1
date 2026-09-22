// frontend/src/pages/admin/ExecutivePerformanceDetail.jsx â€” new file
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getPerfSummary, getPerfTrend, getStageBreakdown, listCommunications, listFeedback, giveFeedback } from "../../api/guest.js";
import PerformanceDocumentationModal from "../../components/PerformanceDocumentationModal.jsx";
import PerformanceCharts from "../../components/PerformanceCharts.jsx";
import PerformancePeriodFilter from "../../components/PerformancePeriodFilter.jsx";
import { defaultAnchor, performanceRangeParams } from "../../components/performancePeriodUtils.js";
import { useRealtimeRefresh } from "../../realtime/realtimeHooks.js";
import StagePerformanceChart from "../../components/StagePerformanceChart.jsx";

export default function ExecutivePerformanceDetail({ onLoggedOut }) {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [period, setPeriod] = useState("weekly");
  const [anchor, setAnchor] = useState(() => defaultAnchor("weekly"));
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [comms, setComms] = useState([]);
  const [feedbackList, setFeedbackList] = useState([]);
  const [newFeedback, setNewFeedback] = useState("");
  const [stageData, setStageData] = useState(null);
  const [showDocumentation, setShowDocumentation] = useState(false);

  function load() {
    const params = performanceRangeParams(period, anchor);
    getPerfSummary({ ...params, user_id: userId }).then((r) => setSummary(r.data)).catch((err) => { if (err.response?.status === 401) onLoggedOut(); });
    getPerfTrend({ start: params.start, end: params.end, user_id: userId }).then((r) => setTrend(r.data)).catch(() => {});
    listCommunications().then((r) => setComms(r.data.filter((c) => c.executive_id === userId).slice(0, 20)));
    listFeedback(userId).then((r) => setFeedbackList(r.data));
    getStageBreakdown({ ...params, user_id: userId }).then((r) => setStageData(r.data)).catch(() => {});
  }
  useEffect(load, [period, anchor, userId]); // eslint-disable-line react-hooks/exhaustive-deps
  useRealtimeRefresh(
    ["tasks", "users", "call_logs", "customer_communications", "executive_targets", "admin_performance_feedback"],
    load,
  );

  async function submitFeedback() {
    if (!newFeedback.trim()) return;
    await giveFeedback(userId, newFeedback.trim());
    setNewFeedback("");
    listFeedback(userId).then((r) => setFeedbackList(r.data));
  }

  if (!summary) return <div className="p-10 text-center text-sm text-[#667085]">à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡â€¦</div>;

  return (
    <div className="mx-auto max-w-6xl px-3 py-3">
      <button onClick={() => navigate("/admin/performance")} className="back-button mb-4">â† à¦¸à¦¬ Communicator</button>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E4E7EC] bg-white p-5">
        <div>
          <h1 className="font-display text-lg font-black text-[#101828]">{summary.name}</h1>
          <div className="mt-1 text-xs text-[#98A2B3]">
            {summary.status === "online" ? "â— Active" : `Last active: ${summary.last_active ? new Date(summary.last_active).toLocaleString("bn-BD") : "â€”"}`}
          </div>
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

      <PerformanceCharts summary={summary} trend={trend} />
      <StagePerformanceChart data={stageData} title={`${summary.name} â€” Guest Stage Breakdown`} />

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        <Stat label="Score" value={`${summary.performance_score} (${summary.performance_category})`} />
        <Stat label="Points" value={`${stageData?.points_earned ?? summary.total_points} / ${stageData?.points_possible ?? 100}`} />
        <Stat label="Active Hours" value={summary.active_hours} />
        <Stat label="Completed Tasks" value={summary.completed_tasks} />
        <Stat label="Contacted" value={`${summary.total_contacted} (${summary.unique_contacted} unique)`} />
        <Stat label="Interested" value={`${summary.interested} (${summary.interest_conversion_rate}%)`} />
        <Stat label="Joined" value={`${summary.joined} (${summary.join_conversion_rate}%)`} />
        <Stat label="Graduated" value={`${summary.graduated} (${summary.graduation_conversion_rate}%)`} />
        <Stat label="Follow-up Rate" value={`${summary.followup_completion_rate}%`} />
        <Stat label="Response Rate" value={`${summary.response_rate}%`} />
        <Stat label="Avg Call Duration" value={`${summary.avg_duration_minutes} min`} />
        <Stat label="No Response" value={summary.no_response} />
      </div>

      <div className="mb-5 rounded-xl border border-[#E4E7EC] bg-white p-5">
        <div className="mb-3 text-sm font-bold text-[#101828]">Recent Communications</div>
        {comms.length === 0 ? <div className="py-4 text-center text-xs text-[#98A2B3]">à¦•à§‹à¦¨à§‹ communication à¦¨à§‡à¦‡à¥¤</div> : (
          <div className="flex flex-col gap-2">
            {comms.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs">
                <span className="font-semibold text-[#101828]">{c.method} â€” {c.outcome}</span>
                <span className="text-[#98A2B3]">{new Date(c.communication_at).toLocaleDateString("bn-BD")}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[#E4E7EC] bg-white p-5">
        <div className="mb-3 text-sm font-bold text-[#101828]">Admin Feedback</div>
        <div className="mb-3 flex flex-col gap-2">
          {feedbackList.map((f) => (
            <div key={f.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-[#344054]">
              {f.feedback}
              <div className="mt-1 text-[10px] text-[#98A2B3]">{new Date(f.created_at).toLocaleDateString("bn-BD")}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="Feedback à¦²à¦¿à¦–à§à¦¨â€¦" value={newFeedback} onChange={(e) => setNewFeedback(e.target.value)} />
          <button onClick={submitFeedback} className="rounded-full bg-[#027A48] px-4 py-2 text-xs font-bold text-white">Send</button>
        </div>
      </div>

      <PerformanceDocumentationModal open={showDocumentation} onClose={() => setShowDocumentation(false)} canEdit />

      <style>{`.input{width:100%;border:1px solid #E4E7EC;border-radius:8px;padding:8px 11px;font-size:13px;outline:none}.input:focus{border-color:#2554C7;box-shadow:0 0 0 3px #EEF4FF}`}</style>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2.5">
      <div className="font-display text-lg font-black text-[#101828]">{value}</div>
      <div className="mt-1 text-[10px] font-semibold text-[#667085]">{label}</div>
    </div>
  );
}
