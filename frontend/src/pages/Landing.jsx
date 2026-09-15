import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import useProjectRef, { withProjectParam } from "../hooks/useProjectRef.js";
import { getPublicConfig } from "../api/guest.js";
import Countdown from "../components/Countdown.jsx";
import InstructionBox from "../components/InstructionBox.jsx";
import { useRealtimeRefresh } from "../realtime/RealtimeContext.jsx";

const DESKTOP_BREAKPOINT = 1024;

function formatDateTimeBn(config) {
  if (config.display_date || config.display_time) {
    return { date: config.display_date, time: config.display_time };
  }
  if (!config.event_date) return { date: "", time: "" };
  const d = new Date(config.event_date);
  return {
    date: d.toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" }),
    time: d.toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" }),
  };
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= DESKTOP_BREAKPOINT : false
  );
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isDesktop;
}

/* ---------- icons (no emoji) ---------- */
const Icon = {
  Calendar: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <rect x="3.5" y="5" width="17" height="16" rx="3" />
      <path strokeLinecap="round" d="M8 3v4M16 3v4M3.5 10h17" />
    </svg>
  ),
  Clock: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5V12l3 2" />
    </svg>
  ),
  Pin: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.4" />
    </svg>
  ),
  Seats: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <circle cx="8.5" cy="8" r="2.8" />
      <circle cx="16" cy="9" r="2.2" />
      <path strokeLinecap="round" d="M3.5 19c0-3 2.4-5 5-5s5 2 5 5M14.5 19c0-2.4 1.7-4.2 3.9-4.6" />
    </svg>
  ),
  Arrow: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" {...p}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  ),
  Ticket: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.2a1.6 1.6 0 0 0 0 3.1V15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.7a1.6 1.6 0 0 0 0-3.1V9z" />
      <path strokeLinecap="round" d="M9 7v10" strokeDasharray="1.6 2.2" />
    </svg>
  ),
  Lock: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" />
      <path strokeLinecap="round" d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </svg>
  ),
  Building: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7a2 2 0 012-2h6.5L21 8.5V17a2 2 0 01-2 2H11a2 2 0 01-2-2z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v12a2 2 0 002 2h10" />
    </svg>
  ),
};

export default function Landing() {
  const projectRef = useProjectRef();
  const [config, setConfig] = useState(null);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const isDesktop = useIsDesktop();

  const loadConfig = () => {
    if (!projectRef) return;
    getPublicConfig(projectRef)
      .then((res) => setConfig(res.data))
      .catch(() => setError("এই ইভেন্টের তথ্য খুঁজে পাওয়া যায়নি।"));
  };

  useEffect(loadConfig, [projectRef]); // eslint-disable-line react-hooks/exhaustive-deps
  useRealtimeRefresh(["projects", "registrations", "form_fields"], loadConfig);

  if (!projectRef) {
    return (
      <StatusScreen>
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Icon.Building className="h-7 w-7" />
        </div>
        <h1 className="font-display text-xl font-bold text-ink">কোনো ইভেন্ট নির্বাচন করা হয়নি</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          লিংকের সাথে সঠিক event query token যোগ করুন, অথবা অ্যাডমিন প্যানেল থেকে একটি event তৈরি করুন।
        </p>
        <Link to="/admin" className="mt-5 inline-block rounded-xl bg-accent px-6 py-2.5 text-sm font-bold text-white hover:bg-accent-hover">
          Admin Panel
        </Link>
      </StatusScreen>
    );
  }

  if (error) {
    return (
      <StatusScreen>
        <h1 className="font-display text-xl font-bold text-danger">{error}</h1>
      </StatusScreen>
    );
  }

  if (!config) {
    return (
      <StatusScreen>
        <p className="text-sm text-muted">লোড হচ্ছে…</p>
      </StatusScreen>
    );
  }

  const { date, time } = formatDateTimeBn(config);
  const seatsFull = Boolean(config.max_registrations) && config.registrations_count >= config.max_registrations;
  const canRegister = config.published && !expired && !seatsFull;
  const regLink = withProjectParam("/register", projectRef);
  const seatsRemaining = config.max_registrations
    ? Math.max(0, config.max_registrations - config.registrations_count)
    : 0;
  const seatPercent = config.max_registrations
    ? Math.min(100, Math.round((config.registrations_count / config.max_registrations) * 100))
    : 0;

  const shared = {
    config,
    date,
    time,
    seatsFull,
    canRegister,
    expired,
    regLink,
    seatsRemaining,
    seatPercent,
    onExpire: () => setExpired(true),
  };

  return isDesktop ? <DesktopCard {...shared} /> : <MobileCard {...shared} />;
}

/* ================= DESKTOP — split screen, light hero + all copy on the white side ================= */

function DesktopCard({ config, date, time, seatsFull, canRegister, expired, regLink, seatsRemaining, seatPercent, onExpire }) {
  const hasInstruction = Boolean(
    (config.home_registration_instruction || "")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/gi, " ")
      .trim()
  );

  return (
    <div className="landing-scroll-hidden flex min-h-screen items-center justify-center overflow-y-auto bg-bg2 px-6 py-6">
      <div className="grid aspect-[8/5] w-full max-w-3xl grid-cols-2 items-stretch overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        {/* hero — full-bleed photo, minimal scrim only where the badge sits */}
        <div className="relative flex aspect-[4/5] h-full flex-col justify-start overflow-hidden border-r border-border bg-white">
          {config.ecard_image_url ? (
            <img
              src={config.ecard_image_url}
              alt="Event card"
              className="absolute inset-0 h-full w-full object-contain object-center"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-bg2">
              <Icon.Building className="h-10 w-10 text-ink-soft/40" />
            </div>
          )}
          <div className="relative z-10 m-5 inline-flex w-fit items-center gap-2 rounded-md border border-white/35 bg-[#173B7A]/50 py-1.5 pl-1.5 pr-3.5 shadow-sm backdrop-blur-md">
            <img src="/quantum-favicon.png" alt="" className="h-5 w-5 flex-none rounded-full object-contain" />
            <span className="text-xs font-bold leading-none text-white">Quantum Foundation</span>
          </div>
        </div>

        {/* white panel — subtle dot-grid texture so it isn't a flat block, title/place/copy live here */}
        <div
          className={`landing-scroll-hidden flex min-h-0 flex-col justify-start overflow-y-auto ${hasInstruction ? "px-6 py-4" : "px-8 py-7"}`}
          style={{
            backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px)",
            backgroundSize: "14px 14px",
          }}
        >
          <h1 className={`font-display font-black tracking-tight text-ink ${hasInstruction ? "text-xl leading-[1.2]" : "text-2xl leading-[1.25]"}`}>
            {config.title_part1} <span className="text-accent">{config.title_part2}</span>
          </h1>

          <div className={`${hasInstruction ? "mt-2.5 space-y-1.5" : "mt-4 space-y-2"}`}>
            {config.place && <FieldTile icon={Icon.Pin} label="স্থান" value={config.place} large compact={hasInstruction} />}
            <div className="grid grid-cols-2 gap-2">
              <FieldTile icon={Icon.Calendar} label="তারিখ" value={date || "শীঘ্রই জানানো হবে"} compact={hasInstruction} />
              <FieldTile icon={Icon.Clock} label="সময়" value={time || "—"} compact={hasInstruction} />
            </div>
          </div>

          {config.event_date && (
            <div className={hasInstruction ? "mt-2" : "mt-3"}>
              <div className={`${hasInstruction ? "mb-1 text-[9px]" : "mb-1.5 text-[10px]"} font-bold uppercase tracking-wide text-ink-soft`}>
                রেজিস্ট্রেশন বন্ধ হতে বাকি
              </div>
              <div className={`rounded-xl border border-border bg-white ${hasInstruction ? "px-3 py-1.5" : "px-4 py-2.5"}`}>
                <Countdown eventDate={config.event_date} onExpire={onExpire} />
              </div>
            </div>
          )}

          {config.max_registrations && !seatsFull && (
            <SeatBar remaining={seatsRemaining} total={config.max_registrations} percent={seatPercent} className={hasInstruction ? "mt-2" : "mt-3"} />
          )}

          <InstructionBox
            html={config.home_registration_instruction}
            compact
            className="mt-2"
          />

          <div className={hasInstruction ? "mt-2.5" : "mt-4"}>
            <CTA compact={hasInstruction} canRegister={canRegister} seatsFull={seatsFull} expired={expired} regLink={regLink} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= MOBILE — stacked version of the same idea ================= */

function MobileCard({ config, date, time, seatsFull, canRegister, expired, regLink, seatsRemaining, seatPercent, onExpire }) {
  return (
    <MobileShell>
      <div className="relative flex w-full items-center justify-center overflow-hidden border-b border-border bg-neutral-100">
        {config.ecard_image_url ? (
          <img
            src={config.ecard_image_url}
            alt="Event card"
            className="block h-auto max-h-[420px] w-full object-contain"
          />
        ) : (
          <div className="flex h-32 w-full items-center justify-center bg-bg2">
            <Icon.Building className="h-8 w-8 text-ink-soft/40" />
          </div>
        )}
        <div className="absolute left-3 top-3 z-10 inline-flex w-fit items-center gap-2 rounded-full border border-white/35 bg-[#173B7A]/50 py-1.5 pl-1.5 pr-4 shadow-sm backdrop-blur-md">
          <img src="/quantum-favicon.png" alt="" className="h-5 w-5 flex-none rounded-full object-contain" />
          <span className="text-[11px] font-semibold leading-none tracking-wide text-white">Quantum Foundation</span>
        </div>
      </div>

      <div className="bg-white px-6 py-4">
        <h1 className="font-display text-lg font-black leading-[1.3] tracking-tight text-ink">
          {config.title_part1} <span className="text-accent">{config.title_part2}</span>
        </h1>

        <div className="mt-2.5 space-y-2">
          {config.place && <FieldTile icon={Icon.Pin} label="স্থান" value={config.place} large compact />}
          <div className="grid grid-cols-2 gap-2">
            <FieldTile icon={Icon.Calendar} label="তারিখ" value={date || "শীঘ্রই জানানো হবে"} />
            <FieldTile icon={Icon.Clock} label="সময়" value={time || "—"} />
          </div>
        </div>

        {config.event_date && (
          <div className="mt-2.5">
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-soft">
              রেজিস্ট্রেশন বন্ধ হতে বাকি
            </div>
            <div className="rounded-xl border border-border bg-white px-4 py-2.5">
              <Countdown eventDate={config.event_date} onExpire={onExpire} />
            </div>
          </div>
        )}

        {config.max_registrations && !seatsFull && (
          <SeatBar remaining={seatsRemaining} total={config.max_registrations} percent={seatPercent} className="mt-2.5" />
        )}

        <InstructionBox
          html={config.home_registration_instruction}
          className="mt-2.5 rounded-xl border border-border bg-white p-3.5 text-ink"
        />

        <div className="mt-4">
          <CTA canRegister={canRegister} seatsFull={seatsFull} expired={expired} regLink={regLink} />
        </div>
      </div>
    </MobileShell>
  );
}

/* ================= SHARED ================= */

function FieldTile({ icon: IconComp, label, value, large = false, compact = false }) {
  if (large) {
    return (
      <div>
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-soft">{label}</div>
        <div className={`flex items-start gap-2.5 rounded-xl border border-border bg-bg2 px-4 ${compact ? "py-3" : "py-3.5"}`}>
          <IconComp className={`mt-0.5 flex-none text-accent ${compact ? "h-4 w-4" : "h-5 w-5"}`} />
          <span className="whitespace-normal break-words text-[13px] font-bold leading-snug text-ink">
            {value}
          </span>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-soft">{label}</div>
      <div className={`flex items-center gap-2 rounded-xl border border-border bg-bg2 ${compact ? "px-3 py-2" : "px-3.5 py-3"}`}>
        <IconComp className="h-4 w-4 flex-none text-accent" />
        <span className={`truncate font-bold text-ink ${compact ? "text-xs" : "text-sm"}`}>{value}</span>
      </div>
    </div>
  );
}

function SeatBar({ remaining, total, percent, className = "" }) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-ink-soft">
        <span className="inline-flex items-center gap-1.5">
          <Icon.Seats className="h-3.5 w-3.5 text-accent" />
          আসন বাকি
        </span>
        <span className="text-ink">
          {remaining} / {total}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function CTA({ canRegister, seatsFull, expired, regLink, compact = false }) {
  if (canRegister) {
    return (
      <Link
        to={regLink}
        className={`group flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 text-sm font-bold text-white transition-colors hover:bg-accent-hover ${compact ? "py-2.5" : "py-3.5"}`}
      >
        রেজিস্ট্রেশন করুন
        <Icon.Arrow className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </Link>
    );
  }
  return (
    <button
      disabled
      className={`flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-border bg-bg2 px-6 text-sm font-bold text-muted ${compact ? "py-2.5" : "py-3.5"}`}
    >
      {seatsFull ? (
        <>
          <Icon.Ticket className="h-4 w-4" /> আসন পূর্ণ হয়ে গেছে
        </>
      ) : expired ? (
        <>
          <Icon.Lock className="h-4 w-4" /> Registration Closed
        </>
      ) : (
        "রেজিস্ট্রেশন এখনো খোলা হয়নি"
      )}
    </button>
  );
}

function StatusScreen({ children }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-bg2 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-white px-6 py-12 text-center shadow-sm">
        {children}
      </div>
    </div>
  );
}

/*
 * Fixed-width "design" card (26rem) scaled via CSS transform to fit any
 * viewport (ResizeObserver + visualViewport). Because the scale factor is
 * derived from the SAME design width/height on every device, the card's
 * on-screen aspect ratio never changes — only its overall size does. This
 * is what keeps the mobile card visually identical (same proportions) on a
 * small phone and a large tablet.
 */
function MobileShell({ children }) {
  const cardRef = useRef(null);
  const [cardSize, setCardSize] = useState({ width: 416, height: 0 });
  const [viewport, setViewport] = useState({
    width: typeof window === "undefined" ? 448 : window.innerWidth,
    height: typeof window === "undefined" ? 900 : window.innerHeight,
  });

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return undefined;

    const updateCardSize = () => {
      setCardSize({ width: card.offsetWidth, height: card.offsetHeight });
    };
    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.visualViewport?.height || window.innerHeight });
    };

    updateCardSize();
    updateViewport();

    const observer = new ResizeObserver(updateCardSize);
    observer.observe(card);
    window.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("resize", updateViewport);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("resize", updateViewport);
    };
  }, []);

  const availableWidth = Math.max(0, viewport.width - 16);
  const availableHeight = Math.max(0, viewport.height - 16);
  const scale = cardSize.height
    ? Math.min(1, availableWidth / cardSize.width, availableHeight / cardSize.height)
    : Math.min(1, availableWidth / cardSize.width);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center overflow-hidden bg-bg2 p-2">
      <div style={{ width: cardSize.width * scale, height: cardSize.height ? cardSize.height * scale : "auto" }}>
        <div
          ref={cardRef}
          className="w-[26rem] overflow-hidden rounded-2xl border border-border bg-white shadow-sm"
          style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
