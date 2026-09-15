import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useProjectRef, { withProjectParam } from "../hooks/useProjectRef.js";

export default function RegistrationError() {
  const projectRef = useProjectRef();
  const [regData, setRegData] = useState({});
  const [errorMsg, setErrorMsg] = useState("Server connection failed. Please try again.");

  useEffect(() => {
    const raw = sessionStorage.getItem(`qf_last_registration_${projectRef}`);
    setRegData(raw ? JSON.parse(raw) : {});
    const msg = sessionStorage.getItem(`qf_error_message_${projectRef}`);
    if (msg) setErrorMsg(msg);
  }, [projectRef]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-9 text-center shadow-xl">
        <div className="mx-auto mb-4.5 flex h-16 w-16 items-center justify-center rounded-full bg-danger-soft text-danger">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-8 w-8">
            <circle cx="12" cy="12" r="9" />
            <path strokeLinecap="round" d="M15 9l-6 6M9 9l6 6" />
          </svg>
        </div>

        <h1 className="font-display text-lg font-black text-danger">Registration Not Saved</h1>
        <p className="mt-1.5 text-xs text-muted">ডেটা সংরক্ষণ নিশ্চিত হয়নি, তাই success দেখানো হয়নি।</p>

        <div className="mt-5 rounded-lg border border-danger/25 border-l-[3px] border-l-danger bg-danger-soft px-3.5 py-3 text-left text-xs leading-relaxed text-danger-700">
          <strong className="mb-0.5 block text-xs">Why it failed</strong>
          <span>{errorMsg}</span>
        </div>

        <div className="mt-3 rounded-lg border border-warning/25 border-l-[3px] border-l-warning bg-warning-soft px-3.5 py-3 text-left text-xs leading-relaxed text-warning">
          <strong className="mb-0.5 block text-xs">What to do now</strong>
          <span>আবার Try Again করুন। একই সমস্যা হলে Helpline-এ যোগাযোগ করুন এবং নিচের Registration ID/Name/Mobile জানান।</span>
        </div>

        <div className="mt-5 rounded-xl border border-dashed border-border bg-bg px-4 py-4 text-left">
          <div className="mb-3 text-center text-[10px] font-bold uppercase tracking-wide text-muted">Submitted Data Preview</div>
          <Row label="Registration ID" value={regData.reg_id} accent />
          <Row label="Name" value={regData.full_name} />
          <Row label="Mobile" value={regData.mobile} />
          <Row label="Email" value={regData.email} />
        </div>

        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
          <Link
            to={withProjectParam("/register", projectRef)}
            className="flex-1 rounded-full bg-danger px-4 py-3 text-sm font-bold text-white hover:opacity-90"
          >
            Try Again
          </Link>
          <a href="tel:+8801335138633" className="flex-1 rounded-full bg-accent px-4 py-3 text-sm font-bold text-white hover:bg-accent-hover">
            Helpline
          </a>
          <Link
            to={withProjectParam("/", projectRef)}
            className="flex-1 rounded-full bg-muted px-4 py-3 text-sm font-bold text-white hover:opacity-90"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, accent }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-none">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-sm font-semibold ${accent ? "text-accent" : "text-ink"}`}>{value || "---"}</span>
    </div>
  );
}
