const COLORS = {
  Interested: "#0ea5e9", Dropped: "#be123c", Counselling: "#d97706", Associate: "#7c3aed",
  "Course Acc": "#4f46e5", "Potential Batch": "#0f766e", QG: "#047857", Quantier: "#15803d",
  QPM: "#a21caf", Ardentiar: "#c2410c", Organier: "#0e7490", Foreigner: "#4d7c0f",
};

export default function StagePerformanceChart({ data, title = "Guest Stage Performance" }) {
  if (!data) return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">Chart loading...</div>;

  const dates = data.dates || [];
  const visibleSeries = (data.series || []).filter((item) => item.values.some((value) => value > 0));
  const series = visibleSeries.length ? visibleSeries : (data.series || []).slice(0, 1);
  const width = 900;
  const height = 350;
  const left = 48;
  const right = width - 24;
  const top = 22;
  const bottom = 285;
  const rawMax = Math.max(1, ...series.flatMap((item) => item.values));
  const yStep = rawMax <= 8 ? 2 : rawMax <= 20 ? 5 : rawMax <= 50 ? 10 : 20;
  const yMax = Math.ceil(rawMax / yStep) * yStep;
  const x = (index) => dates.length <= 1 ? (left + right) / 2 : left + (index / (dates.length - 1)) * (right - left);
  const y = (value) => top + (1 - Number(value || 0) / yMax) * (bottom - top);
  const tickStep = dates.length > 180 ? 30 : dates.length > 60 ? 15 : dates.length > 20 ? 5 : dates.length > 10 ? 2 : 1;

  return (
    <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-800">{title} — {capitalize(data.period)}</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {data.aggregation === "total"
              ? `${data.consultant_count} communicators · All completed outcomes combined`
              : `Total completed guest outcomes: ${data.total_clients}`}
          </p>
        </div>
        <div className="rounded-xl bg-blue-50 px-4 py-2 text-right">
          <div className="text-lg font-black text-blue-700">{data.points_earned} / {data.points_possible}</div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-blue-500">Points earned</div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {series.map((item) => (
          <span key={item.stage} className="flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600">
            <i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[item.stage] }} /> {item.stage}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[350px] min-w-[760px] w-full" role="img" aria-label="Stage performance multi-line chart">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const py = top + ratio * (bottom - top);
            const value = yMax * (1 - ratio);
            return (
              <g key={ratio}>
                <line x1={left} x2={right} y1={py} y2={py} stroke="#E4E7EC" />
                <text x={left - 9} y={py + 4} textAnchor="end" fontSize="10" fontWeight="700" fill="#667085">{value}</text>
              </g>
            );
          })}
          <line x1={left} x2={left} y1={top} y2={bottom} stroke="#98A2B3" />
          <line x1={left} x2={right} y1={bottom} y2={bottom} stroke="#98A2B3" />

          {series.map((item) => {
            const points = item.values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
            return (
              <g key={item.stage}>
                <polyline points={points} fill="none" stroke={COLORS[item.stage] || "#64748b"} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                {item.values.map((value, index) => (
                  <circle key={index} cx={x(index)} cy={y(value)} r="3" fill={COLORS[item.stage] || "#64748b"}>
                    <title>{`${item.stage} · ${dates[index]} · ${value}`}</title>
                  </circle>
                ))}
              </g>
            );
          })}

          {dates.map((date, index) => {
            const show = index % tickStep === tickStep - 1 || index === dates.length - 1;
            if (!show) return null;
            const parsed = new Date(`${date}T00:00:00`);
            const label = dates.length > 60
              ? parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
              : String(parsed.getDate());
            return <text key={date} x={x(index)} y={bottom + 20} textAnchor="middle" fontSize="10" fontWeight="700" fill="#667085">{label}</text>;
          })}
          <text x={(left + right) / 2} y={height - 12} textAnchor="middle" fontSize="11" fontWeight="700" fill="#667085">Date</text>
              <text x="13" y={(top + bottom) / 2} textAnchor="middle" fontSize="11" fontWeight="700" fill="#667085" transform={`rotate(-90 13 ${(top + bottom) / 2})`}>Guests</text>
        </svg>
      </div>
    </section>
  );
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}
