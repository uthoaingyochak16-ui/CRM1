// frontend/src/pages/admin/settings/MyAccountSection.jsx
import { useState } from "react";
import { changeOwnPassword } from "../../../api/guest.js";
import Field from "./Field.jsx";
import PasswordInput from "../../../components/PasswordInput.jsx";

export default function MyAccountSection({ onBack }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage(null);

    if (!currentPassword) {
      setMessage({ type: "error", text: "Current password লিখুন।" });
      return;
    }
    if (newPassword.length < 10 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setMessage({ type: "error", text: "নতুন password কমপক্ষে ১০ অক্ষরের হতে হবে।" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New password এবং confirm password মিলছে না।" });
      return;
    }

    setBusy(true);
    try {
      await changeOwnPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage({ type: "success", text: "✓ Password পরিবর্তন হয়েছে।" });
    } catch (requestError) {
      setMessage({ type: "error", text: requestError.response?.data?.detail || "Password পরিবর্তন করা যায়নি।" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-3 py-3">
      <button onClick={onBack} className="back-button mb-4">
        ← Back to Settings
      </button>

      <section className="rounded-xl border border-[#E4E7EC] bg-white p-5">
        <h2 className="text-sm font-bold text-[#101828]">My Account — Change Password</h2>
        <p className="mb-4 mt-1 text-[12px] text-[#667085]">নিজের account password পরিবর্তন করুন।</p>

        <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
          <Field label="Current Password">
            <PasswordInput required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </Field>
          <Field label="New Password">
            <PasswordInput required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </Field>
          <Field label="Confirm New Password">
            <PasswordInput required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </Field>

          {message && (
            <div className={`rounded-lg px-3 py-2 text-xs font-medium ${message.type === "error" ? "bg-[#FEF3F2] text-[#D92D20]" : "bg-[#ECFDF3] text-[#027A48]"}`}>
              {message.text}
            </div>
          )}

          <button type="submit" disabled={busy} className="self-start rounded-full bg-[#2554C7] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#17368F] disabled:opacity-60">
            {busy ? "Updating..." : "Update Password"}
          </button>
        </form>
      </section>
    </main>
  );
}
