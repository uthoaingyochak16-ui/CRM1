import { useEffect, useState } from "react";

function pad(n) {
  return String(Math.max(0, n)).padStart(2, "0");
}

function diffParts(eventDate) {
  const diff = new Date(eventDate).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins: Math.floor((diff % 3600000) / 60000),
    secs: Math.floor((diff % 60000) / 1000),
  };
}

function Box({ value, label, active }) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border px-2 py-1.5 min-w-[46px] transition-colors ${
        active ? "border-accent/30 bg-accent-soft" : "border-border bg-white"
      }`}
    >
      <span className="font-display text-lg font-bold text-ink tabular-nums">{pad(value)}</span>
      <span className="text-[9px] font-semibold uppercase tracking-wide text-faint">{label}</span>
    </div>
  );
}

export default function Countdown({ eventDate, onExpire }) {
  const [parts, setParts] = useState(eventDate ? diffParts(eventDate) : null);

  useEffect(() => {
    if (!eventDate) return;
    const id = setInterval(() => {
      const next = diffParts(eventDate);
      setParts(next);
      if (!next && onExpire) onExpire();
    }, 1000);
    return () => clearInterval(id);
  }, [eventDate, onExpire]);

  if (!eventDate) return null;

  if (!parts) {
    return (
      <div className="rounded-lg bg-success-soft px-4 py-2 text-center text-sm font-semibold text-success">
        🎉 ইভেন্ট শুরু হয়েছে! স্বাগতম।
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2">
      <Box value={parts.days} label="দিন" active={parts.days > 0} />
      <Box value={parts.hours} label="ঘণ্টা" active={parts.hours > 0 || parts.days > 0} />
      <Box value={parts.mins} label="মিনিট" active={parts.mins > 0 || parts.hours > 0 || parts.days > 0} />
      <Box value={parts.secs} label="সেকেন্ড" active />
    </div>
  );
}
