import { useMemo } from "react";
import { PERIODS } from "./performancePeriodUtils.js";

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
