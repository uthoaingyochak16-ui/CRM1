import { useEffect, useState } from "react";
import { getPointRules, setPointRules } from "../api/guest.js";

const POINT_LABELS = {
  comm_success: ["Successful communication", "Guest-এর সাথে সফলভাবে যোগাযোগ হলে"],
  interested: ["Interested outcome", "Guest Interested stage/result দিলে"],
  wants_to_join: ["Wants to join", "Program-এ join করতে আগ্রহ নিশ্চিত করলে"],
  joined: ["Joined program", "Guest program-এ join করলে"],
  graduated: ["Graduated", "Guest graduate সম্পন্ন করলে"],
  followup_on_time: ["Follow-up on time", "নির্ধারিত সময়ের মধ্যে follow-up complete করলে"],
  profile_update: ["Profile update", "Guest profile-এর প্রয়োজনীয় তথ্য update করলে"],
  missed_followup: ["Missed follow-up", "নির্ধারিত follow-up সময়মতো না করলে"],
};

const SCORE_DOC = [
  ["Active hours", "15", "Selected period-এর active সময়; ৮ ঘণ্টায় সর্বোচ্চ point"],
  ["Total attempts", "15", "Communication attempt; ২০ attempt-এ সর্বোচ্চ point"],
  ["Interest conversion", "20", "Total attempt-এর মধ্যে Interested result-এর হার"],
  ["Join conversion", "20", "Interested guest-এর মধ্যে join করার হার"],
  ["Follow-up completion", "20", "Due follow-up-এর মধ্যে complete করার হার"],
  ["Completed tasks", "10", "১০টি completed task-এ সর্বোচ্চ point"],
];

const RATING_DOC = [
  ["90–100", "Excellent", "bg-emerald-50 text-emerald-700"],
  ["75–89.9", "Very Good", "bg-blue-50 text-blue-700"],
  ["60–74.9", "Good", "bg-amber-50 text-amber-700"],
  ["40–59.9", "Needs Improvement", "bg-orange-50 text-orange-700"],
  ["0–39.9", "Poor", "bg-rose-50 text-rose-700"],
];

export default function PerformanceDocumentationModal({ open, onClose, canEdit = false }) {
  const [rules, setRules] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSaved(false);
    getPointRules().then((response) => setRules(response.data)).catch(() => setRules([]));
  }, [open]);

  async function saveRules() {
    setSaving(true);
    setSaved(false);
    try {
      await setPointRules(rules.map((rule) => ({ key: rule.key, points: Number(rule.points) || 0 })));
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#101828]/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[#F1F2F4] bg-white px-5 py-4">
          <div>
            <div className="text-lg font-black text-[#101828]">Performance Documentation</div>
            <div className="mt-1 text-xs text-[#667085]">কোন কাজে কত point এবং score অনুযায়ী performance অবস্থান।</div>
          </div>
          <button onClick={onClose} className="rounded-full border border-[#E4E7EC] px-3 py-1.5 text-xs font-semibold text-[#667085]">Close</button>
        </div>

        <div className="space-y-6 px-5 py-5">
          <section className="rounded-2xl border-2 border-[#84ADFF] bg-[#F5F8FF] p-4 shadow-sm">
            <div className="mb-1 text-base font-black text-[#17368F]">Point Distribution</div>
            <p className="mb-3 text-xs text-[#475467]">No Response ও Duplicate Entry-তে কোনো point যোগ বা বিয়োগ হবে না।</p>
            <div className="overflow-hidden rounded-xl border border-[#B2CCFF] bg-white">
              <table className="w-full text-sm">
                <thead className="bg-[#EEF4FF]">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-[#17368F]">কাজ / Result</th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-[#17368F]">কখন count হবে</th>
                    <th className="w-28 px-4 py-2.5 text-center text-xs font-bold text-[#17368F]">Point</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => {
                    const [label, detail] = POINT_LABELS[rule.key] || [rule.key, ""];
                    return (
                      <tr key={rule.key} className="border-t border-[#E4E7EC]">
                        <td className="px-4 py-3 font-bold text-[#101828]">{label}</td>
                        <td className="px-4 py-3 text-xs text-[#667085]">{detail}</td>
                        <td className="px-4 py-3 text-center">
                          {canEdit ? (
                            <input type="number" step="0.5" value={rule.points}
                              onChange={(event) => setRules((current) => current.map((item) => item.key === rule.key ? { ...item, points: event.target.value } : item))}
                              className="w-20 rounded-lg border border-[#B2CCFF] px-2 py-1.5 text-center font-black text-[#2554C7] outline-none focus:border-[#2554C7]" />
                          ) : (
                            <span className={`font-black ${Number(rule.points) < 0 ? "text-[#D92D20]" : "text-[#2554C7]"}`}>{rule.points}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {canEdit && (
              <div className="mt-3 flex items-center gap-3">
                <button onClick={saveRules} disabled={saving} className="rounded-full bg-[#2554C7] px-5 py-2 text-xs font-bold text-white disabled:opacity-50">
                  {saving ? "Saving..." : "Save Point Distribution"}
                </button>
                {saved && <span className="text-xs font-bold text-[#027A48]">✓ Saved</span>}
              </div>
            )}
          </section>

          <section>
            <div className="mb-2 text-sm font-black text-[#101828]">Score Calculation — মোট 100</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {SCORE_DOC.map(([label, point, detail]) => (
                <div key={label} className="rounded-xl border border-[#E4E7EC] bg-[#FAFBFD] p-3">
                  <div className="flex justify-between gap-2 text-sm font-bold text-[#101828]"><span>{label}</span><span className="text-[#2554C7]">{point}</span></div>
                  <div className="mt-1 text-[11px] leading-5 text-[#667085]">{detail}</div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-2 text-sm font-black text-[#101828]">Performance Status</div>
            <div className="grid gap-2 sm:grid-cols-5">
              {RATING_DOC.map(([range, label, color]) => (
                <div key={label} className={`rounded-xl px-3 py-3 text-center ${color}`}>
                  <div className="text-base font-black">{range}</div>
                  <div className="mt-1 text-[11px] font-bold">{label}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
