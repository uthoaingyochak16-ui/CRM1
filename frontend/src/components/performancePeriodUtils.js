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

export { PERIODS, pad, currentWeekValue };

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
