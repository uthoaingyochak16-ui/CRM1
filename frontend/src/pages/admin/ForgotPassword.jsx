import { useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../../api/guest.js";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try { const response = await requestPasswordReset(email.trim()); setMessage(response.data.message); }
    catch (err) { setError(err.response?.data?.detail || "Request পাঠানো যায়নি।"); }
    finally { setBusy(false); }
  }

  return <AuthCard title="Password ভুলে গেছেন?" subtitle="আপনার account-এর email address লিখুন।">
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-xs font-bold text-[#475467]">Email address
        <input required type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className="mt-1.5 w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-sm outline-none focus:border-[#2554C7] focus:ring-2 focus:ring-[#EEF4FF]" />
      </label>
      {message && <div className="rounded-lg bg-[#ECFDF3] p-3 text-xs font-semibold text-[#027A48]">{message}</div>}
      {error && <div className="rounded-lg bg-[#FEF3F2] p-3 text-xs font-semibold text-[#D92D20]">{error}</div>}
      <button disabled={busy} className="w-full rounded-lg bg-[#2554C7] py-2.5 text-sm font-bold text-white disabled:opacity-60">{busy ? "পাঠানো হচ্ছে…" : "Reset link পাঠান"}</button>
      <Link to="/admin" className="block text-center text-xs font-bold text-[#2554C7]">Login-এ ফিরে যান</Link>
    </form>
  </AuthCard>;
}

export function AuthCard({ title, subtitle, children }) {
  return <div className="flex min-h-screen items-center justify-center bg-[#F7F9FC] p-4"><div className="w-full max-w-md rounded-2xl border border-[#E4E7EC] bg-white p-7 shadow-xl">
    <div className="mb-5 flex items-center gap-2"><img src="/quantum-favicon.png" className="h-9 w-9" alt="" /><span className="font-black text-[#101828]">Quantum Foundation</span></div>
    <h1 className="text-xl font-black text-[#101828]">{title}</h1><p className="mb-6 mt-1.5 text-sm text-[#667085]">{subtitle}</p>{children}
  </div></div>;
}
