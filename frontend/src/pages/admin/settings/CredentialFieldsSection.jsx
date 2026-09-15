// frontend/src/pages/admin/settings/CredentialFieldsSection.jsx
import { useEffect, useState } from "react";
import { listSettings, replaceSettings } from "../../../api/guest.js";
import Field from "./Field.jsx";
import { reloadPage } from "../../../utils/reload.js";

export default function CredentialFieldsSection({ title, category, fields, onBack, onLoggedOut }) {
  const [values, setValues] = useState({});
  const [hasValue, setHasValue] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listSettings()
      .then((response) => {
        const nextValues = {};
        const nextHasValue = {};
        fields.forEach((f) => {
          nextValues[f.key] = "";
          nextHasValue[f.key] = false;
        });
        response.data.forEach((s) => {
          if (fields.some((f) => f.key === s.key)) {
            nextHasValue[s.key] = s.has_value;
            if (!s.is_secret && s.value !== undefined && s.value !== null) {
              nextValues[s.key] = s.value;
            }
          }
        });
        setValues(nextValues);
        setHasValue(nextHasValue);
      })
      .catch((requestError) => {
        if (requestError.response?.status === 401) {
          if (onLoggedOut) onLoggedOut();
          return;
        }
        setError("Settings লোড করা যায়নি।");
      })
      .finally(() => setLoading(false));
  }, [category, fields, onLoggedOut]);

  function setFieldValue(key, value) {
    setValues((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const payload = fields.map((f) => ({
        key: f.key,
        label: f.label,
        category,
        is_secret: f.is_secret,
        value: values[f.key] || "",
      }));
      const response = await replaceSettings(payload);
      const nextHasValue = {};
      const nextValues = { ...values };
      response.data.forEach((s) => {
        if (fields.some((f) => f.key === s.key)) {
          nextHasValue[s.key] = s.has_value;
          if (!s.is_secret && s.value !== undefined && s.value !== null) {
            nextValues[s.key] = s.value;
          }
        }
      });
      setHasValue(nextHasValue);
      setValues(nextValues);
      setSaved(true);
      reloadPage({ settingsActiveSetting: category });
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Settings save করা যায়নি।");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-3 py-3">
      <button onClick={onBack} className="back-button mb-4">
        ← Back to Settings
      </button>

      <section className="rounded-xl border border-[#E4E7EC] bg-white p-5">
        <h2 className="text-sm font-bold text-[#101828]">{title}</h2>

        {loading ? (
          <div className="py-6 text-center text-xs text-[#98A2B3]">লোড হচ্ছে…</div>
        ) : (
          <div className="mt-4 flex max-w-md flex-col gap-4">
            {fields.map((f) => (
              <Field key={f.key} label={f.label}>
                <input
                  type={f.is_secret ? "password" : "text"}
                  className="input"
                  placeholder={f.is_secret && hasValue[f.key] ? "•••••••• (set — খালি রাখলে আগের value থাকবে)" : ""}
                  value={values[f.key] || ""}
                  onChange={(e) => setFieldValue(f.key, e.target.value)}
                />
              </Field>
            ))}

            {error && <div className="rounded-lg bg-[#FEF3F2] px-3 py-2 text-xs text-[#D92D20]">{error}</div>}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="self-start rounded-full bg-[#027A48] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#05603A] disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              {saved && <span className="text-xs font-semibold text-[#027A48]">✓ Saved</span>}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
