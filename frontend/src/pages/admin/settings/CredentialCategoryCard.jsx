// frontend/src/pages/admin/settings/CredentialCategoryCard.jsx
import { useEffect, useState } from "react";
import { listSettings, replaceSettings } from "../../../api/guest.js";
import { reloadPage } from "../../../utils/reload.js";

export default function CredentialCategoryCard({ title, category, fields, onBack, onLoggedOut }) {
  const [values, setValues] = useState({});
  const [hasValue, setHasValue] = useState({});
  const [others, setOthers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    listSettings()
      .then((res) => {
        const mine = {};
        const has = {};
        const otherRows = [];
        res.data.forEach((s) => {
          if (s.category === category && fields.some((f) => f.key === s.key)) {
            mine[s.key] = "";
            has[s.key] = s.has_value;
          } else if (s.category === category) {
            otherRows.push(s);
          }
        });
        setValues(mine);
        setHasValue(has);
        setOthers(otherRows);
      })
      .catch((err) => { if (err.response?.status === 401) onLoggedOut(); })
      .finally(() => setLoading(false));
  }, [category, fields, onLoggedOut]);

  function set(key, val) {
    setValues((v) => ({ ...v, [key]: val }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = [
        ...fields.map((f) => ({ key: f.key, label: f.label, category, is_secret: f.is_secret, value: values[f.key] || "" })),
        ...others.map((o) => ({ key: o.key, label: o.label, category: o.category, is_secret: o.is_secret, value: o.value || "" })),
      ];
      const res = await replaceSettings(payload);
      const has = {};
      res.data.forEach((s) => { if (fields.some((f) => f.key === s.key)) has[s.key] = s.has_value; });
      setHasValue(has);
      setSaved(true);
      reloadPage({ settingsActiveSetting: category });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-3 py-3">
      <button onClick={onBack} className="back-button mb-4">← Back to Settings</button>
      <div className="rounded-xl border border-[#E4E7EC] bg-white p-5">
        <div className="mb-4 text-sm font-bold text-[#101828]">{title}</div>
        {loading ? (
          <div className="py-6 text-center text-xs text-[#98A2B3]">লোড হচ্ছে…</div>
        ) : (
          <div className="flex max-w-sm flex-col gap-3.5">
            {fields.map((f) => (
              <label key={f.key} className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">{f.label}</span>
                <input
                  type={f.is_secret ? "password" : "text"}
                  className="input"
                  placeholder={f.is_secret && hasValue[f.key] ? "•••••••• (set — blank leaves unchanged)" : ""}
                  value={values[f.key] || ""}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              </label>
            ))}
            <div className="mt-1 flex items-center gap-3">
              <button onClick={handleSave} disabled={saving} className="rounded-full bg-[#027A48] px-5 py-2.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60">
                {saving ? "Saving…" : "Save"}
              </button>
              {saved && <span className="text-xs font-semibold text-[#027A48]">✓ Saved</span>}
            </div>
          </div>
        )}
      </div>
      <style>{`.input{width:100%;border:1px solid #E4E7EC;border-radius:8px;padding:9px 11px;font-size:13px;outline:none}.input:focus{border-color:#2554C7;box-shadow:0 0 0 3px #EEF4FF}`}</style>
    </div>
  );
}
