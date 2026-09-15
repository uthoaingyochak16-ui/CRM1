import { useEffect, useState } from "react";

function formatHours(value) {
  const minutes = Math.round(Number(value || 0) * 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h ${rest}m`;
}

function MetricBar({ label, value, color = "#2554C7" }) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div>
      <div className="mb-1 flex justify-between text-[10px] font-semibold text-[#667085]">
        <span>{label}</span>
        <span>{safeValue}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#EAECF0]">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${safeValue}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export default function PerformanceCharts({ summary, trend = [] }) {
  const chartTrend = trend.length > 31 ? trend.slice(-31) : trend;
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const containsToday = trend.some((day) => day.date === todayKey);
  const defaultSelectedDate = containsToday ? todayKey : trend[trend.length - 1]?.date || "";
  const [selectedDate, setSelectedDate] = useState(defaultSelectedDate);

  useEffect(() => {
    setSelectedDate(defaultSelectedDate);
  }, [defaultSelectedDate]);

  const selectedDay = trend.find((day) => day.date === selectedDate) || trend[trend.length - 1] || {};
  const selectedIsToday = selectedDay.date === todayKey;
  const selectedLabel = selectedIsToday
    ? "Today"
    : selectedDay.date
      ? new Date(`${selectedDay.date}T00:00:00`).toLocaleDateString("en-GB", {
          weekday: "short",
          day: "2-digit",
          month: "short",
        })
      : "Selected Day";
  const rawMaxHours = Math.max(
    1,
    ...chartTrend.map((day) => Math.max(Number(day.active_hours || 0), Number(day.productive_hours || 0))),
  );
  const hourStep = rawMaxHours <= 8 ? 2 : rawMaxHours <= 20 ? 5 : rawMaxHours <= 40 ? 10 : 20;
  const maxHours = Math.ceil(rawMaxHours / hourStep) * hourStep;
  const tickStep = chartTrend.length > 20 ? 5 : chartTrend.length > 10 ? 2 : 1;
  const chartWidth = 600;
  const chartHeight = 170;
  const plotTop = 12;
  const plotBottom = 132;
  const plotLeft = 48;
  const plotRight = chartWidth - 24;
  const pointX = (index) => chartTrend.length <= 1 ? (plotLeft + plotRight) / 2 : plotLeft + (index / (chartTrend.length - 1)) * (plotRight - plotLeft);
  const pointY = (value) => plotTop + (1 - Math.min(Number(value || 0), maxHours) / maxHours) * (plotBottom - plotTop);
  const activePoints = chartTrend.map((day, index) => `${pointX(index)},${pointY(day.active_hours)}`).join(" ");
  const productivePoints = chartTrend.map((day, index) => `${pointX(index)},${pointY(day.productive_hours)}`).join(" ");
  const weeklyActive = trend.reduce((total, day) => total + Number(day.active_hours || 0), 0);
  const weeklyProductive = trend.reduce((total, day) => total + Number(day.productive_hours || 0), 0);
  const score = Math.max(0, Math.min(100, Number(summary.performance_score || 0)));

  return (
    <div className="mb-5 grid gap-3 lg:grid-cols-12">
      <section className="rounded-xl border border-[#DCE4F2] bg-white p-4 shadow-sm lg:col-span-9">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-[#101828]">Work Time</h2>
            <p className="text-[10px] text-[#667085]">Active বনাম recorded productive time</p>
          </div>
          <div className="flex gap-3 text-[9px] font-semibold text-[#667085]">
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-[#2554C7]" /> Active</span>
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-[#33B78B]" /> Productive</span>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-[#F7F9FC] p-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[#667085]">{selectedLabel} Active</div>
            <div className="mt-0.5 text-xl font-black text-[#17368F]">{formatHours(selectedDay.active_hours ?? 0)}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[#667085]">{selectedLabel} Proper Work</div>
            <div className="mt-0.5 text-xl font-black text-[#027A48]">{formatHours(selectedDay.productive_hours ?? 0)}</div>
          </div>
          <div className="text-[10px] text-[#667085]">Range active: <b className="text-[#344054]">{formatHours(weeklyActive)}</b></div>
          <div className="text-[10px] text-[#667085]">Range productive: <b className="text-[#344054]">{formatHours(weeklyProductive)}</b></div>
        </div>

        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-48 min-w-[600px] w-full" role="img" aria-label="Active and productive time line chart">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = plotTop + ratio * (plotBottom - plotTop);
              const value = maxHours * (1 - ratio);
              return (
                <g key={ratio}>
                  <line x1={plotLeft} x2={plotRight} y1={y} y2={y} stroke="#E4E7EC" strokeWidth="1" />
                  <text x={plotLeft - 8} y={y + 3} textAnchor="end" fontSize="9" fontWeight="700" fill="#667085">{value}h</text>
                </g>
              );
            })}
            <line x1={plotLeft} x2={plotLeft} y1={plotTop} y2={plotBottom} stroke="#98A2B3" strokeWidth="1.2" />
            <polyline points={activePoints} fill="none" stroke="#2554C7" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
            <polyline points={productivePoints} fill="none" stroke="#33B78B" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
            {chartTrend.map((day, index) => {
              const selected = day.date === selectedDay.date;
              const showTick = index % tickStep === tickStep - 1 || index === chartTrend.length - 1;
              const dayNumber = new Date(`${day.date}T00:00:00`).getDate();
              return (
                <g key={day.date} onClick={() => setSelectedDate(day.date)} className="cursor-pointer">
                  <circle cx={pointX(index)} cy={pointY(day.active_hours)} r={selected ? 5 : 3} fill="#2554C7" stroke="white" strokeWidth="2" />
                  <circle cx={pointX(index)} cy={pointY(day.productive_hours)} r={selected ? 5 : 3} fill="#33B78B" stroke="white" strokeWidth="2" />
                  {selected && (
                    <>
                      <text x={pointX(index) + 8} y={pointY(day.active_hours) - 7} fontSize="9" fontWeight="800" fill="#2554C7">
                        {formatHours(day.active_hours)}
                      </text>
                      <text x={pointX(index) + 8} y={pointY(day.productive_hours) + 13} fontSize="9" fontWeight="800" fill="#027A48">
                        {formatHours(day.productive_hours)}
                      </text>
                    </>
                  )}
                  <rect x={pointX(index) - 9} y={plotTop} width="18" height={plotBottom - plotTop} fill="transparent">
                    <title>{`${day.date}: Active ${formatHours(day.active_hours)}, Productive ${formatHours(day.productive_hours)}`}</title>
                  </rect>
                  {showTick && <text x={pointX(index)} y="153" textAnchor="middle" fontSize="10" fontWeight="700" fill={selected ? "#17368F" : "#667085"}>{dayNumber}</text>}
                </g>
              );
            })}
            <text x={chartWidth / 2} y="168" textAnchor="middle" fontSize="10" fontWeight="700" fill="#667085">Date</text>
          </svg>
        </div>
      </section>

      <section className="rounded-xl border border-[#DCE4F2] bg-white p-4 shadow-sm lg:col-span-3">
        <h2 className="text-sm font-black text-[#101828]">Performance Score</h2>
        <div className="my-4 flex justify-center">
          <div
            className="flex h-32 w-32 items-center justify-center rounded-full"
            style={{ background: `conic-gradient(#2554C7 ${score * 3.6}deg, #EAECF0 0deg)` }}
          >
            <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white">
              <span className="text-3xl font-black text-[#17368F]">{score}</span>
              <span className="text-[9px] font-bold uppercase text-[#667085]">{summary.performance_category}</span>
            </div>
          </div>
        </div>
        <div className="space-y-2.5">
          <MetricBar label="Interest conversion" value={summary.interest_conversion_rate} />
          <MetricBar label="Join conversion" value={summary.join_conversion_rate} color="#7F56D9" />
          <MetricBar label="Follow-up completion" value={summary.followup_completion_rate} color="#33B78B" />
          <MetricBar label="Response rate" value={summary.response_rate} color="#F79009" />
        </div>
      </section>
    </div>
  );
}
