import { useState } from "react";

const OPTIONS = [
  ["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"], ["yearly", "Yearly"],
];

const pad = (value) => String(value).padStart(2, "0");
const dateValue = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

function currentValue(period) {
  const now = new Date();
  if (period === "daily") return dateValue(now);
  if (period === "monthly") return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  if (period === "yearly") return String(now.getFullYear());
  const thursday = new Date(now);
  thursday.setDate(now.getDate() + 4 - (now.getDay() || 7));
  const start = new Date(thursday.getFullYear(), 0, 1);
  const week = Math.ceil((((thursday - start) / 86400000) + 1) / 7);
  return `${thursday.getFullYear()}-W${pad(week)}`;
}

function bounds(period, value) {
  if (!value) return { from: "", to: "" };
  if (period === "daily") return { from: value, to: value };
  if (period === "yearly") return { from: `${value}-01-01`, to: `${value}-12-31` };
  if (period === "monthly") {
    const [year, month] = value.split("-").map(Number);
    return { from: `${value}-01`, to: dateValue(new Date(year, month, 0)) };
  }
  const [yearText, weekText] = value.split("-W");
  const year = Number(yearText); const week = Number(weekText);
  const jan4 = new Date(year, 0, 4);
  const monday = new Date(year, 0, 4 - (jan4.getDay() || 7) + 1 + (week - 1) * 7);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  return { from: dateValue(monday), to: dateValue(sunday) };
}

export default function PeriodRangeFilter({ onChange, className = "" }) {
  const [period, setPeriod] = useState("daily");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const type = period === "yearly" ? "number" : period === "monthly" ? "month" : period === "weekly" ? "week" : "date";

  const emit = (nextPeriod, nextFrom, nextTo) => {
    const fromBounds = bounds(nextPeriod, nextFrom);
    const toBounds = bounds(nextPeriod, nextTo);
    onChange?.({ period: nextPeriod, dateFrom: fromBounds.from, dateTo: toBounds.to });
  };
  const choosePeriod = (nextPeriod) => {
    const value = currentValue(nextPeriod);
    setPeriod(nextPeriod); setFrom(value); setTo(value);
    emit(nextPeriod, value, value);
  };
  const clear = () => { setFrom(""); setTo(""); onChange?.({ period, dateFrom: "", dateTo: "" }); };

  return <div className={`flex flex-wrap items-center gap-2 ${className}`}>
    <select value={period} onChange={(e) => choosePeriod(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:border-blue-500">
      {OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
    <input type={type} min={period === "yearly" ? "2000" : undefined} max={period === "yearly" ? "2100" : undefined} value={from} onChange={(e) => { setFrom(e.target.value); emit(period, e.target.value, to); }} className="min-w-[130px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500" aria-label={`From ${period}`} />
    <span className="text-xs font-bold text-slate-400">to</span>
    <input type={type} min={period === "yearly" ? (from || "2000") : from} max={period === "yearly" ? "2100" : undefined} value={to} onChange={(e) => { setTo(e.target.value); emit(period, from, e.target.value); }} className="min-w-[130px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500" aria-label={`To ${period}`} />
    {(from || to) && <button type="button" onClick={clear} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500">Clear</button>}
  </div>;
}
