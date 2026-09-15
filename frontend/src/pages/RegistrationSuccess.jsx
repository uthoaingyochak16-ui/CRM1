import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import useProjectRef from "../hooks/useProjectRef.js";
import { getPublicConfig, getRegistrationEmailStatus, API_BASE } from "../api/guest.js";
import { arrangeDataKeys } from "../utils/dataArrangement.js";

const EXCLUDE_KEYS = new Set(["project_id", "source", "email_sent", "email_status"]);
const SPECIAL_LABELS = { reg_date: "Registered On", reg_id: "Registration ID" };

function titleize(key) {
  return String(key || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function RegistrationSuccess() {
  const projectRef = useProjectRef();
  const [searchParams] = useSearchParams();
  const [labelMap, setLabelMap] = useState({});
  const [regData, setRegData] = useState({});
  const [paymentInfo, setPaymentInfo] = useState(null);

  useEffect(() => {
    const paymentParam = searchParams.get("payment");
    const tranId = searchParams.get("tran_id");

    if (paymentParam === "success" && tranId) {
      const backed = localStorage.getItem("pending_payment_event");
      if (backed) {
        try {
          const saved = JSON.parse(backed);
          setRegData(saved.regData || {});
          setLabelMap(saved.labelMap || {});
          fetch(`${API_BASE}/api/payment/status/${tranId}`)
            .then((r) => r.json())
            .then((d) => setPaymentInfo(d))
            .catch(() => setPaymentInfo({ tran_id: tranId }));
          localStorage.removeItem("pending_payment_event");
          return;
        } catch { }
      }
    }

    const ref = projectRef;
    if (!ref) return;
    const raw = sessionStorage.getItem(`qf_last_registration_${ref}`);
    setRegData(raw ? JSON.parse(raw) : {});
  }, [projectRef, searchParams]);

  useEffect(() => {
    if (!projectRef || !regData.reg_id || regData.email_status !== "pending") return;
    let attempts = 0;
    const timer = window.setInterval(async () => {
      attempts += 1;
      try {
        const response = await getRegistrationEmailStatus(projectRef, regData.reg_id);
        const status = response.data.status;
        setRegData((current) => ({
          ...current,
          email_status: status,
          email_sent: Boolean(response.data.email_sent),
        }));
        if (status !== "pending") window.clearInterval(timer);
      } catch {
        if (attempts >= 30) window.clearInterval(timer);
      }
      if (attempts >= 30) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [projectRef, regData.reg_id, regData.email_status]);

  useEffect(() => {
    const paymentParam = searchParams.get("payment");
    if (paymentParam === "success") return;

    if (!projectRef) return;
    getPublicConfig(projectRef)
      .then((res) => {
        const map = {};
        res.data.form_fields.forEach((f) => (map[f.key] = f.label));
        setLabelMap(map);
      })
      .catch(() => { });
  }, [projectRef, searchParams]);

  const orderedKeys = [];
  Object.keys(labelMap).forEach((k) => {
    if (k in regData && !EXCLUDE_KEYS.has(k) && !orderedKeys.includes(k)) orderedKeys.push(k);
  });
  Object.keys(regData).forEach((k) => {
    if (EXCLUDE_KEYS.has(k) || orderedKeys.includes(k) || k === "reg_id" || k === "reg_date") return;
    orderedKeys.push(k);
  });
  if (regData.reg_id) orderedKeys.unshift("reg_id");
  if (regData.reg_date) orderedKeys.push("reg_date");
  const arrangedKeys = [
    ...(regData.reg_id ? ["reg_id"] : []),
    ...arrangeDataKeys(orderedKeys.filter((key) => !["reg_id", "reg_date"].includes(key))),
    ...(regData.reg_date ? ["reg_date"] : []),
  ];

  const isPaymentSuccess = searchParams.get("payment") === "success";

  return (
    <div
      className="flex min-h-screen items-center justify-center p-2 sm:p-6"
      style={{ background: "#F5F7FB", fontFamily: "'DM Sans', 'Noto Sans Bengali', sans-serif" }}
    >
      <style>{`.qf-value-scroll::-webkit-scrollbar { display: none; }`}</style>
      <div
        className="relative w-full max-w-[480px] overflow-hidden rounded-[22px] border sm:max-w-[420px]"
        style={{
          background: "#FFFFFF",
          borderColor: "#E2E8F0",
          boxShadow: "0 24px 60px -20px rgba(15, 23, 42, 0.2)",
        }}
      >
        {/* Top section */}
        <div className="px-4 pb-[22px] pt-8 text-center sm:px-8">
          <div
            className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              background: "#ECFDF3",
              color: "#15803D",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 26, height: 26 }}>
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1
            className="mb-1.5 text-[20px] font-black sm:text-[22px]"
            style={{ fontFamily: "'Playfair Display', serif", color: "#0F172A" }}
          >
            {isPaymentSuccess ? "Payment Successful" : "Registration Successful"}
          </h1>
          <p className="text-[13px] leading-relaxed" style={{ color: "#64748B" }}>
            {isPaymentSuccess
              ? "আপনার পেমেন্ট সফলভাবে সম্পন্ন হয়েছে।"
              : "আপনার আবেদনটি সফলভাবে গৃহীত হয়েছে।"}
          </p>

          {isPaymentSuccess && paymentInfo?.tran_id && (
            <div
              className="mt-3 inline-block max-w-full truncate rounded-full px-4 py-1.5 text-xs font-bold"
              style={{ background: "#EFF6FF", color: "#2563EB" }}
              title={paymentInfo.tran_id}
            >
              Transaction ID: {paymentInfo.tran_id}
            </div>
          )}
          {paymentInfo?.amount && (
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <div className="whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "#EFF6FF", color: "#2563EB" }}>
                ৳{paymentInfo.amount}
              </div>
              {paymentInfo.card_type && (
                <div className="whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold uppercase" style={{ background: "#EFF6FF", color: "#2563EB" }}>
                  {paymentInfo.card_type}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Perforated divider */}
        <div className="relative mx-4 sm:mx-8" style={{ borderTop: "2px dashed #E2E8F0" }}>
          <span className="absolute top-1/2 -translate-y-1/2 rounded-full" style={{ left: -32, width: 26, height: 26, background: "#F5F7FB" }} />
          <span className="absolute top-1/2 -translate-y-1/2 rounded-full" style={{ right: -32, width: 26, height: 26, background: "#F5F7FB" }} />
        </div>

        {/* Bottom section */}
        <div className="px-4 pb-[30px] pt-5 sm:px-8">
          <div className="mb-[22px]">
            {arrangedKeys.length === 0 ? (
              <div className="py-2.5 text-center text-[12.5px]" style={{ color: "#94A3B8" }}>
                No details available
              </div>
            ) : (
              arrangedKeys.map((key, idx) => {
                const value = regData[key] || "—";
                const label = SPECIAL_LABELS[key] || labelMap[key] || titleize(key);
                return (
                  <div
                    key={key}
                    className="grid items-baseline gap-x-2 py-[9px]"
                    style={{
                      gridTemplateColumns: "minmax(0, 42%) minmax(0, 1fr)",
                      borderBottom: idx === arrangedKeys.length - 1 ? "none" : "1px solid #E2E8F0",
                    }}
                  >
                    <span
                      className="qf-value-scroll block text-[10.5px] font-medium leading-snug sm:text-[11.5px]"
                      style={{
                        color: "#64748B",
                        whiteSpace: "nowrap",
                        overflowX: "auto",
                        WebkitOverflowScrolling: "touch",
                        scrollbarWidth: "none",
                        msOverflowStyle: "none",
                      }}
                      title={label}
                    >
                      {label}
                    </span>
                    <span
                      className="qf-value-scroll block text-right text-[12px] font-semibold leading-snug sm:text-[13px]"
                      style={{
                        color: "#334155",
                        whiteSpace: "nowrap",
                        overflowX: "auto",
                        WebkitOverflowScrolling: "touch",
                        scrollbarWidth: "none",
                        msOverflowStyle: "none",
                      }}
                    >
                      {value}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {regData.email_sent && (
            <div
              role="status"
              className="rounded-2xl border px-4 py-4 text-left"
              style={{ background: "#F0FDF4", borderColor: "#BBF7D0" }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-full"
                  style={{ background: "#DCFCE7", color: "#15803D" }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" style={{ width: 19, height: 19 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5l8.1 5.4a1.6 1.6 0 001.8 0L21 7.5M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h2 className="text-[13px] font-extrabold" style={{ color: "#166534" }}>
                    নিশ্চিতকরণ ইমেইল পাঠানো হয়েছে
                  </h2>
                  <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "#3F6212" }}>
                    আপনার রেজিস্ট্রেশন সফলভাবে সম্পন্ন হয়েছে। রেজিস্ট্রেশনের বিস্তারিত তথ্যসহ একটি
                    নিশ্চিতকরণ ইমেইল আপনার দেওয়া ইমেইল ঠিকানায় সফলভাবে পাঠানো হয়েছে।
                  </p>
                  <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: "#4D7C0F" }}>
                    অনুগ্রহ করে Inbox দেখুন। ইমেইলটি না পেলে Spam অথবা Junk folder-ও পরীক্ষা করুন।
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}