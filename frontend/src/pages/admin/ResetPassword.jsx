import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resetPasswordWithToken } from "../../api/guest.js";
import PasswordInput from "../../components/PasswordInput.jsx";
import { AuthCard } from "./ForgotPassword.jsx";

export default function ResetPassword() {
  const [params] = useSearchParams(); const token = params.get("token") || "";
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError("");
    if (password !== confirm) return setError("দুইটি password মিলছে না।");
    setBusy(true); try { const response = await resetPasswordWithToken(token, password); setMessage(response.data.message); }
    catch (err) { setError(err.response?.data?.detail || "Password পরিবর্তন করা যায়নি।"); } finally { setBusy(false); }
  }
  return <AuthCard title="নতুন Password সেট করুন" subtitle="কমপক্ষে ১০ অক্ষর, একটি letter ও একটি number দিন।">
    {message ? <div className="space-y-4"><div className="rounded-lg bg-[#ECFDF3] p-3 text-sm font-semibold text-[#027A48]">{message}</div><Link to="/admin" className="block rounded-lg bg-[#2554C7] py-2.5 text-center text-sm font-bold text-white">Login করুন</Link></div> :
    <form onSubmit={submit} className="space-y-4"><label className="block text-xs font-bold text-[#475467]">New password<PasswordInput required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-sm outline-none focus:border-[#2554C7]" /></label><label className="block text-xs font-bold text-[#475467]">Confirm password<PasswordInput required minLength={10} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-sm outline-none focus:border-[#2554C7]" /></label>{error && <div className="rounded-lg bg-[#FEF3F2] p-3 text-xs font-semibold text-[#D92D20]">{error}</div>}<button disabled={busy || !token} className="w-full rounded-lg bg-[#2554C7] py-2.5 text-sm font-bold text-white disabled:opacity-60">{busy ? "সংরক্ষণ হচ্ছে…" : "Password পরিবর্তন করুন"}</button></form>}
  </AuthCard>;
}
