// frontend/src/pages/admin/settings/ChangePasswordCard.jsx
import { useState } from "react";
import { changeOwnPassword } from "../../../api/guest.js";
import PasswordInput from "../../../components/PasswordInput.jsx";

export default function ChangePasswordCard({ onBack }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage(null);
    if (next.length < 10 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) return setMessage({ type: "error", text: "পাসওয়ার্ডে কমপক্ষে ১০ অক্ষর, একটি letter ও একটি number থাকতে হবে।" });
    if (next !== confirm) return setMessage({ type: "error", text: "নতুন পাসওয়ার্ড দুটো মিলছে না।" });
    setBusy(true);
    try {
      await changeOwnPassword(current, next);
      setMessage({ type: "success", text: "✓ পাসওয়ার্ড পরিবর্তন হয়েছে।" });
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.detail || "পরিবর্তন ব্যর্থ হয়েছে।" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-3 py-3">
      <button onClick={onBack} className="back-button mb-4">← Back to Settings</button>
      <div className="rounded-xl border border-[#E4E7EC] bg-white p-5">
        <div className="mb-4 text-sm font-bold text-[#101828]">Change My Password</div>
        <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-3.5">
          <Field label="Current Password"><PasswordInput value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
          <Field label="New Password"><PasswordInput value={next} onChange={(e) => setNext(e.target.value)} /></Field>
          <Field label="Confirm New Password"><PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
          {message && (
            <div className={`rounded-lg px-3 py-2 text-xs font-medium ${message.type === "error" ? "bg-[#FEF3F2] text-[#D92D20]" : "bg-[#ECFDF3] text-[#027A48]"}`}>
              {message.text}
            </div>
          )}
          <button type="submit" disabled={busy} className="mt-1 self-start rounded-full bg-[#2554C7] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#17368F] disabled:opacity-60">
            {busy ? "সংরক্ষণ হচ্ছে…" : "Update Password"}
          </button>
        </form>
      </div>
      <style>{`.input{width:100%;border:1px solid #E4E7EC;border-radius:8px;padding:9px 11px;font-size:13px;outline:none}.input:focus{border-color:#2554C7;box-shadow:0 0 0 3px #EEF4FF}`}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">{label}</span>
      {children}
    </label>
  );
}
