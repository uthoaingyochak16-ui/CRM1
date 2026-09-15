import { useMemo } from "react";

const PERIODS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

function pad(value) {
  return String(value).padStart(2, "0");
}

function currentWeekValue() {
  const date = new Date();
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${pad(week)}`;
}

export function defaultAnchor(period) {
  const now = new Date();
  if (period === "daily") return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  if (period === "weekly") return currentWeekValue();
  if (period === "monthly") return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  return String(now.getFullYear());
}

export function performanceRangeParams(period, anchor) {
  if (!anchor) return { period };
  let start;
  let end;

  if (period === "daily") {
    start = new Date(`${anchor}T00:00:00`);
    end = new Date(start);
    end.setDate(end.getDate() + 1);
  } else if (period === "weekly") {
    const [yearText, weekText] = anchor.split("-W");
    const year = Number(yearText);
    const week = Number(weekText);
    const januaryFourth = new Date(year, 0, 4);
    const monday = new Date(januaryFourth);
    monday.setDate(januaryFourth.getDate() - ((januaryFourth.getDay() || 7) - 1) + ((week - 1) * 7));
    monday.setHours(0, 0, 0, 0);
    start = monday;
    end = new Date(start);
    end.setDate(end.getDate() + 7);
  } else if (period === "monthly") {
    const [year, month] = anchor.split("-").map(Number);
    start = new Date(year, month - 1, 1);
    end = new Date(year, month, 1);
  } else {
    const year = Number(anchor);
    start = new Date(year, 0, 1);
    end = new Date(year + 1, 0, 1);
  }

  const localIso = (date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return { period: "custom", start: localIso(start), end: localIso(end) };
}

export default function PerformancePeriodFilter({ period, anchor, onChange, allowedPeriods = null }) {
  const visiblePeriods = allowedPeriods
    ? PERIODS.filter((item) => allowedPeriods.includes(item.value))
    : PERIODS;
  const inputType = period === "daily" ? "date" : period === "weekly" ? "week" : period === "monthly" ? "month" : "number";
  const inputProps = useMemo(
    () => period === "yearly" ? { min: 2020, max: 2100, step: 1 } : {},
    [period],
  );

  return (
    <div className="flex items-center gap-2">
      {visiblePeriods.length > 1 && (
        <select
          value={period}
          onChange={(event) => {
            const nextPeriod = event.target.value;
            onChange(nextPeriod, defaultAnchor(nextPeriod));
          }}
          className="rounded-lg border border-[#D0D5DD] bg-white px-2.5 py-2 text-xs font-semibold text-[#344054]"
        >
          {visiblePeriods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      )}
      <input
        type={inputType}
        value={anchor}
        onChange={(event) => onChange(period, event.target.value)}
        className="w-[145px] rounded-lg border border-[#D0D5DD] bg-white px-2.5 py-1.5 text-xs text-[#344054] outline-none focus:border-[#2554C7] focus:ring-2 focus:ring-[#EEF4FF]"
        {...inputProps}
      />
    </div>
  );
}
