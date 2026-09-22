import { useCallback, useEffect, useState } from "react";
import {
  API_BASE,
  changeOwnPassword,
  listSettings,
  replaceSettings,
  saveLoginImageUrl,
  saveLoginPanelText,
  sendTestEmail,
  updateOwnProfile,
  uploadLoginImage,
  uploadOwnProfileImage,
} from "../../api/guest.js";
import { useAutosave } from "../../hooks/useAutosave.js";
import { consumeReloadState, reloadPage } from "../../utils/reload.js";
import { useRealtimeRefresh } from "../../realtime/realtimeHooks.js";
import PasswordInput from "../../components/PasswordInput.jsx";

const CALL_FIELDS = [
  { key: "call_provider", label: "Provider Name (e.g. Zoiper)", is_secret: false, defaultValue: "Zoiper / System Dialer" },
  { key: "call_uri_template", label: "Call URI Template (tel:{phone} / sip:{phone}@domain)", is_secret: false, defaultValue: "tel:{phone}" },
  { key: "call_country_code", label: "Default Country Code (e.g. +880)", is_secret: false, defaultValue: "+880" },
  { key: "call_account_sid", label: "Account SID", is_secret: false },
  { key: "call_auth_token", label: "Auth Token", is_secret: true },
  { key: "call_api_key", label: "API Key", is_secret: true },
];

const EMAIL_FIELDS = [
  { key: "email_smtp_host", label: "SMTP Host", is_secret: false },
  { key: "email_smtp_port", label: "SMTP Port", is_secret: false },
  { key: "email_smtp_user", label: "SMTP User", is_secret: false },
  { key: "email_smtp_password", label: "SMTP Password", is_secret: true },
  { key: "email_from_name", label: "Sender Name", is_secret: false },
];

const WHATSAPP_FIELDS = [
  { key: "whatsapp_api_key", label: "API Key", is_secret: true },
  { key: "whatsapp_instance_id", label: "Instance ID", is_secret: false },
  { key: "whatsapp_webhook_url", label: "Webhook URL", is_secret: false },
];

const SETTINGS_OPTIONS = [
  { id: "password", title: "My Account & Profile", desc: "Profile data, photo à¦à¦¬à¦‚ password update à¦•à¦°à§à¦¨", icon: "ðŸ‘¤", adminOnly: false },
  { id: "login-appearance", title: "Login Page Image", desc: "Login card-à¦à¦° image à¦ªà¦°à¦¿à¦¬à¦°à§à¦¤à¦¨ à¦•à¦°à§à¦¨", icon: "ðŸ–¼ï¸", superAdminOnly: true },
  { id: "call", title: "Direct Call & Zoiper Setup", desc: "Zoiper, system dialer à¦…à¦¥à¦¬à¦¾ custom SIP/softphone configure à¦•à¦°à§à¦¨", icon: "ðŸ“ž", adminOnly: true },
  { id: "email", title: "Email Configuration", desc: "SMTP Host, Port, User, Password setup", icon: "âœ‰ï¸", adminOnly: true },
  { id: "whatsapp", title: "WhatsApp Configuration", desc: "API Key, Instance ID, Webhook setup", icon: "ðŸ’¬", adminOnly: true },
  { id: "ai", title: "AI Setup", desc: "AI widget enable/disable à¦à¦¬à¦‚ AI access permission setup", icon: "âœ¨", adminOnly: true },
];

const AI_SETTING_DEFS = [
  { key: "ai_access_customers", label: "Guests Access", value: "false", is_secret: false },
  { key: "ai_access_tasks", label: "Tasks Access", value: "false", is_secret: false },
  { key: "ai_access_reports", label: "Reports Access", value: "false", is_secret: false },
  { key: "ai_access_registrations", label: "Registrations Access", value: "false", is_secret: false },
];

const AI_RESOURCE_OPTIONS = [
  { key: "ai_access_customers", title: "Guests", desc: "AI guest profile data niye guidance dite parbe." },
  { key: "ai_access_tasks", title: "Tasks", desc: "AI task summary ebong follow-up context use korte parbe." },
  { key: "ai_access_reports", title: "Reports", desc: "AI report-related context niye assist korte parbe." },
  { key: "ai_access_registrations", title: "Registrations", desc: "AI registration data niye answer korte parbe." },
];

export default function SettingsPage({ currentUser, onLoggedOut }) {
  const isAdmin = currentUser?.role === "admin";
  const [activeSetting, setActiveSetting] = useState(() => consumeReloadState()?.settingsActiveSetting || null);
  const visibleOptions = SETTINGS_OPTIONS.filter(
    (o) => (!o.adminOnly || isAdmin) && (!o.superAdminOnly || currentUser?.is_super_admin),
  );

  const handleBack = () => setActiveSetting(null);
  useRealtimeRefresh(["app_settings"], () => {
    reloadPage({ settingsActiveSetting: activeSetting });
  });

  switch (activeSetting) {
    case "password":
      return <MyAccountSection onBack={handleBack} currentUser={currentUser} />;
    case "login-appearance":
      return <LoginAppearanceSection onBack={handleBack} onLoggedOut={onLoggedOut} />;
    case "call":
      return (
        <CredentialFieldsSection
          title="Direct Call & Zoiper Setup"
          category="call"
          fields={CALL_FIELDS}
          onBack={handleBack}
          onLoggedOut={onLoggedOut}
        />
      );
    case "email":
      return (
        <CredentialFieldsSection
          title="Email Configuration"
          category="email"
          fields={EMAIL_FIELDS}
          onBack={handleBack}
          onLoggedOut={onLoggedOut}
        />
      );
    case "whatsapp":
      return (
        <CredentialFieldsSection
          title="WhatsApp Configuration"
          category="whatsapp"
          fields={WHATSAPP_FIELDS}
          onBack={handleBack}
          onLoggedOut={onLoggedOut}
        />
      );
    case "ai":
      return <AISetupSection onBack={handleBack} onLoggedOut={onLoggedOut} />;
    default:
      return (
        <main className="mx-auto max-w-3xl px-3 py-3">
          <div className="mb-6">
            <h1 className="font-display text-xl font-black text-[#101828]">Settings</h1>
            <p className="mt-1 text-xs text-[#667085]">Account à¦à¦¬à¦‚ system settings manage à¦•à¦°à§à¦¨à¥¤</p>
          </div>

          <div className="flex flex-col gap-2.5">
            {visibleOptions.map((o) => (
              <button
                key={o.id}
                onClick={() => setActiveSetting(o.id)}
                className="flex items-center gap-3 rounded-xl border border-[#E4E7EC] bg-white p-4 text-left hover:border-[#2554C7]"
              >
                <span className="text-xl">{o.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-[#101828]">{o.title}</div>
                  <div className="text-xs text-[#667085]">{o.desc}</div>
                </div>
                <span className="text-[#98A2B3]">â†’</span>
              </button>
            ))}
          </div>
        </main>
      );
  }
}

function LoginAppearanceSection({ onBack, onLoggedOut }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [panelTitle, setPanelTitle] = useState("Manage everything from one secure dashboard.");
  const [panelSubtitle, setPanelSubtitle] = useState("Registrations, records, and reports â€” all in one panel.");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    listSettings()
      .then((response) => {
        const value = response.data.find((item) => item.key === "login_panel_image_url")?.value || "";
        setPreview(value && !value.startsWith("http") ? `${API_BASE}${value}` : value);
        setImageUrl(value.startsWith("http") ? value : "");
        setPanelTitle(response.data.find((item) => item.key === "login_panel_title")?.value || "Manage everything from one secure dashboard.");
        setPanelSubtitle(response.data.find((item) => item.key === "login_panel_subtitle")?.value || "Registrations, records, and reports â€” all in one panel.");
      })
      .catch((error) => {
        if (error.response?.status === 401 && onLoggedOut) onLoggedOut();
      });
  }, [onLoggedOut]);

  function handleFileChange(event) {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;
    if (nextFile.size > 8 * 1024 * 1024) {
      setMessage({ type: "error", text: "Login image à¦¸à¦°à§à¦¬à§‹à¦šà§à¦š 8 MB à¦¹à¦¤à§‡ à¦ªà¦¾à¦°à¦¬à§‡à¥¤" });
      return;
    }
    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
    setMessage(null);
  }

  async function handleUpload(event) {
    event.preventDefault();
    if (!file) {
      setMessage({ type: "error", text: "à¦ªà§à¦°à¦¥à¦®à§‡ à¦à¦•à¦Ÿà¦¿ image à¦¨à¦¿à¦°à§à¦¬à¦¾à¦šà¦¨ à¦•à¦°à§à¦¨à¥¤" });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await uploadLoginImage(file);
      const value = response.data.panel_image_url;
      setPreview(value.startsWith("http") ? value : `${API_BASE}${value}`);
      setImageUrl("");
      setFile(null);
      setMessage({ type: "success", text: "âœ“ Login page image à¦ªà¦°à¦¿à¦¬à¦°à§à¦¤à¦¨ à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤" });
    } catch (error) {
      if (error.response?.status === 401 && onLoggedOut) {
        onLoggedOut();
        return;
      }
      setMessage({ type: "error", text: error.response?.data?.detail || "Image upload à¦•à¦°à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤" });
    } finally {
      setBusy(false);
    }
  }

  async function handleUrlSave() {
    const value = imageUrl.trim();
    if (!/^https?:\/\//i.test(value)) {
      setMessage({ type: "error", text: "à¦¸à¦ à¦¿à¦• http:// à¦…à¦¥à¦¬à¦¾ https:// image URL à¦¦à¦¿à¦¨à¥¤" });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await saveLoginImageUrl(value);
      setPreview(response.data.panel_image_url);
      setFile(null);
      setMessage({ type: "success", text: "âœ“ Login image URL save à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤" });
    } catch (error) {
      if (error.response?.status === 401 && onLoggedOut) {
        onLoggedOut();
        return;
      }
      setMessage({ type: "error", text: error.response?.data?.detail || "Image URL save à¦•à¦°à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤" });
    } finally {
      setBusy(false);
    }
  }

  async function handleTextSave() {
    if (!panelTitle.trim()) {
      setMessage({ type: "error", text: "Login card title à¦–à¦¾à¦²à¦¿ à¦°à¦¾à¦–à¦¾ à¦¯à¦¾à¦¬à§‡ à¦¨à¦¾à¥¤" });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await saveLoginPanelText(panelTitle.trim(), panelSubtitle.trim());
      setPanelTitle(response.data.panel_title);
      setPanelSubtitle(response.data.panel_subtitle);
      setMessage({ type: "success", text: "âœ“ Login card text à¦ªà¦°à¦¿à¦¬à¦°à§à¦¤à¦¨ à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤" });
    } catch (error) {
      if (error.response?.status === 401 && onLoggedOut) {
        onLoggedOut();
        return;
      }
      setMessage({ type: "error", text: error.response?.data?.detail || "Login card text save à¦•à¦°à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-3 py-3">
      <button onClick={onBack} className="back-button mb-4">â† Back to Settings</button>
      <section className="rounded-xl border border-[#E4E7EC] bg-white p-5">
        <h2 className="text-base font-bold text-[#101828]">Login Page Image</h2>
        <p className="mt-1 text-xs text-[#667085]">à¦à¦‡ image login card-à¦à¦° image panel-à¦ à¦¸à¦¬ account-à¦à¦° à¦œà¦¨à§à¦¯ à¦¦à§‡à¦–à¦¾à¦¬à§‡à¥¤</p>

        <form onSubmit={handleUpload} className="mt-5 max-w-md">
          <div className="flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-xl border border-[#E4E7EC] bg-white sm:aspect-[16/10]">
            {preview ? (
              <img src={preview} alt="Login page preview" className="h-full w-full object-contain" />
            ) : (
              <span className="text-xs text-[#98A2B3]">Current image preview à¦¨à§‡à¦‡</span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="cursor-pointer rounded-full border border-[#D0D5DD] bg-white px-4 py-2.5 text-xs font-bold text-[#344054] hover:border-[#2554C7] hover:text-[#2554C7]">
              Choose Image
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
            </label>
            <button type="submit" disabled={busy || !file} className="rounded-full bg-[#2554C7] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#17368F] disabled:opacity-50">
              {busy ? "Uploading..." : "Save Login Image"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-[#667085]">JPG, PNG à¦¬à¦¾ WEBP Â· à¦¸à¦°à§à¦¬à§‹à¦šà§à¦š 8 MB</p>

          <div className="my-5 flex items-center gap-3 text-[11px] font-bold uppercase tracking-wide text-[#98A2B3]">
            <span className="h-px flex-1 bg-[#E4E7EC]" /> à¦…à¦¥à¦¬à¦¾ URL à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦° à¦•à¦°à§à¦¨ <span className="h-px flex-1 bg-[#E4E7EC]" />
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#667085]">Image URL</span>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="url"
                className="input flex-1"
                placeholder="https://example.com/login-image.jpg"
                value={imageUrl}
                onChange={(event) => {
                  setImageUrl(event.target.value);
                  setMessage(null);
                }}
              />
              <button type="button" onClick={handleUrlSave} disabled={busy || !imageUrl.trim()} className="rounded-full border border-[#2554C7] bg-white px-5 py-2.5 text-xs font-bold text-[#2554C7] hover:bg-[#EEF4FF] disabled:opacity-50">
                {busy ? "Saving..." : "Save URL"}
              </button>
            </div>
          </label>

          <div className="my-5 h-px bg-[#E4E7EC]" />

          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-bold text-[#101828]">Image Card Text</h3>
              <p className="mt-1 text-[11px] text-[#667085]">Image-à¦à¦° à¦‰à¦ªà¦°à§‡ à¦¦à§‡à¦–à¦¾à¦¨à§‹ title à¦à¦¬à¦‚ subtitle à¦ªà¦°à¦¿à¦¬à¦°à§à¦¤à¦¨ à¦•à¦°à§à¦¨à¥¤</p>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#667085]">Title</span>
              <input
                type="text"
                maxLength={160}
                className="input w-full"
                value={panelTitle}
                onChange={(event) => {
                  setPanelTitle(event.target.value);
                  setMessage(null);
                }}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#667085]">Subtitle</span>
              <textarea
                rows={3}
                maxLength={240}
                className="input w-full resize-y"
                value={panelSubtitle}
                onChange={(event) => {
                  setPanelSubtitle(event.target.value);
                  setMessage(null);
                }}
              />
            </label>
            <button type="button" onClick={handleTextSave} disabled={busy || !panelTitle.trim()} className="rounded-full bg-[#2554C7] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#17368F] disabled:opacity-50">
              {busy ? "Saving..." : "Save Card Text"}
            </button>
          </div>

          {message && (
            <div className={`mt-4 rounded-lg px-3 py-2 text-xs font-medium ${message.type === "error" ? "bg-[#FEF3F2] text-[#D92D20]" : "bg-[#ECFDF3] text-[#027A48]"}`}>
              {message.text}
            </div>
          )}
        </form>
      </section>
    </main>
  );
}

function AISetupSection({ onBack, onLoggedOut }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(AI_SETTING_DEFS.map((item) => [item.key, item.value]))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listSettings()
      .then((response) => {
        const nextValues = Object.fromEntries(AI_SETTING_DEFS.map((item) => [item.key, item.value]));
        response.data.forEach((item) => {
          if (item.key in nextValues) nextValues[item.key] = item.value || "false";
        });
        setValues(nextValues);
      })
      .catch((requestError) => {
        if (requestError.response?.status === 401) {
          if (onLoggedOut) onLoggedOut();
          return;
        }
        setError("AI settings à¦²à§‹à¦¡ à¦•à¦°à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤");
      })
      .finally(() => setLoading(false));
  }, [onLoggedOut]);

  const widgetEnabled = true;

  function setBooleanValue(key, checked) {
    setSaved(false);
    setValues((current) => ({ ...current, [key]: checked ? "true" : "false" }));
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const payload = AI_SETTING_DEFS.map((item) => ({
        key: item.key,
        label: item.label,
        category: "ai",
        is_secret: item.is_secret,
        value: values[item.key] || item.value,
      }));
      await replaceSettings(payload);
      setSaved(true);
      reloadPage({ settingsActiveSetting: "ai" });
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        if (onLoggedOut) onLoggedOut();
        return;
      }
      setError(requestError.response?.data?.detail || "AI settings save à¦•à¦°à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-3 py-3">
      <button onClick={onBack} className="back-button mb-4">
        â† Back to Settings
      </button>

      <section className="rounded-xl border border-[#E4E7EC] bg-white p-5">
        <h2 className="text-sm font-bold text-[#101828]">AI Setup</h2>
        <p className="mt-1 text-[12px] text-[#667085]">AI chat widget system-wide on/off à¦•à¦°à§à¦¨, à¦¤à¦¾à¦°à¦ªà¦° AI à¦•à§‹à¦¨ à¦•à§‹à¦¨ data area use à¦•à¦°à¦¤à§‡ à¦ªà¦¾à¦°à¦¬à§‡ à¦¸à§‡à¦Ÿà¦¾à¦° permission à¦¦à¦¿à¦¨à¥¤</p>

        {loading ? (
          <div className="py-6 text-center text-xs text-[#98A2B3]">à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡â€¦</div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-[#B2CCFF] bg-[#EEF4FF] p-4">
              <div className="text-sm font-bold text-[#1849A9]">AI Widget à¦¸à¦¬à¦¾à¦° à¦œà¦¨à§à¦¯ Available</div>
              <div className="mt-1 text-xs text-[#2554C7]">à¦¸à¦¬ active Admin à¦“ Communicator à¦¨à¦¿à¦œ account à¦¥à§‡à¦•à§‡ AI widget à¦à¦¬à¦‚ provider settings à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦° à¦•à¦°à¦¤à§‡ à¦ªà¦¾à¦°à¦¬à§‡à¦¨à¥¤</div>
            </div>

            <div className={`rounded-xl border p-4 ${widgetEnabled ? "border-[#E4E7EC] bg-white" : "border-[#E4E7EC] bg-[#F9FAFB] opacity-60"}`}>
              <div className="mb-3">
                <div className="text-sm font-bold text-[#101828]">AI Permission Settings</div>
                <div className="mt-1 text-xs text-[#667085]">AI widget enable à¦¥à¦¾à¦•à¦²à§‡ à¦¨à¦¿à¦šà§‡à¦° resource access à¦—à§à¦²à§‹ à¦•à¦¾à¦°à§à¦¯à¦•à¦° à¦¹à¦¬à§‡à¥¤</div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {AI_RESOURCE_OPTIONS.map((item) => (
                  <label key={item.key} className={`rounded-xl border p-3 ${widgetEnabled ? "border-[#E4E7EC] bg-[#FCFCFD]" : "border-[#E4E7EC] bg-[#F3F4F6]"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[#101828]">{item.title}</div>
                        <div className="mt-1 text-[11px] leading-5 text-[#667085]">{item.desc}</div>
                      </div>
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4"
                        checked={values[item.key] === "true"}
                        disabled={!widgetEnabled}
                        onChange={(event) => setBooleanValue(item.key, event.target.checked)}
                      />
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {error && <div className="rounded-lg bg-[#FEF3F2] px-3 py-2 text-xs text-[#D92D20]">{error}</div>}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-full bg-[#2554C7] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#17368F] disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save AI Setup"}
              </button>
              {saved && !saving && <span className="text-xs font-semibold text-[#027A48]">âœ“ Saved</span>}
            </div>

            <div className="rounded-xl border border-dashed border-[#D0D5DD] bg-[#FAFBFD] px-4 py-3 text-xs text-[#667085]">
              User-specific AI chat widget access `Users & Access Control` section à¦¥à§‡à¦•à§‡ manage à¦•à¦°à¦¬à§‡à¦¨à¥¤
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function MyAccountSection({ onBack, currentUser }) {
  const [profile, setProfile] = useState({
    name: currentUser?.name || "",
    phone: currentUser?.phone || "",
    email: currentUser?.email || "",
    designation: currentUser?.designation || "",
    center: currentUser?.center || "",
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(
    currentUser?.profile_image_url
      ? `${currentUser.profile_image_url.startsWith("http") ? "" : API_BASE}${currentUser.profile_image_url}`
      : ""
  );
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  function storeUpdatedUser(user) {
    sessionStorage.setItem("qf_current_user", JSON.stringify(user));
    window.dispatchEvent(new Event("qf:current-user-updated"));
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setProfileMessage({ type: "error", text: "Profile image à¦¸à¦°à§à¦¬à§‹à¦šà§à¦š 5 MB à¦¹à¦¤à§‡ à¦ªà¦¾à¦°à¦¬à§‡à¥¤" });
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setProfileMessage(null);
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();
    setProfileMessage(null);
    setProfileBusy(true);
    try {
      let response = await updateOwnProfile(profile);
      if (imageFile) {
        response = await uploadOwnProfileImage(imageFile);
        setImageFile(null);
      }
      storeUpdatedUser(response.data);
      setProfile(response.data);
      setImagePreview(
        response.data.profile_image_url
          ? `${response.data.profile_image_url.startsWith("http") ? "" : API_BASE}${response.data.profile_image_url}`
          : ""
      );
      setProfileMessage({ type: "success", text: "âœ“ Profile à¦¸à¦«à¦²à¦­à¦¾à¦¬à§‡ update à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤" });
    } catch (requestError) {
      setProfileMessage({ type: "error", text: requestError.response?.data?.detail || "Profile update à¦•à¦°à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤" });
    } finally {
      setProfileBusy(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage(null);

    if (!currentPassword) {
      setMessage({ type: "error", text: "Current password à¦²à¦¿à¦–à§à¦¨à¥¤" });
      return;
    }
    if (newPassword.length < 10 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setMessage({ type: "error", text: "à¦¨à¦¤à§à¦¨ password à¦•à¦®à¦ªà¦•à§à¦·à§‡ à§§à§¦ à¦…à¦•à§à¦·à¦°à§‡à¦° à¦¹à¦¤à§‡ à¦¹à¦¬à§‡à¥¤" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New password à¦à¦¬à¦‚ confirm password à¦®à¦¿à¦²à¦›à§‡ à¦¨à¦¾à¥¤" });
      return;
    }

    setBusy(true);
    try {
      await changeOwnPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage({ type: "success", text: "âœ“ Password à¦ªà¦°à¦¿à¦¬à¦°à§à¦¤à¦¨ à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤" });
    } catch (requestError) {
      setMessage({ type: "error", text: requestError.response?.data?.detail || "Password à¦ªà¦°à¦¿à¦¬à¦°à§à¦¤à¦¨ à¦•à¦°à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-3 py-3">
      <button onClick={onBack} className="back-button mb-4">
        â† Back to Settings
      </button>

      <section className="mb-4 rounded-xl border border-[#E4E7EC] bg-white p-5">
        <h2 className="text-base font-bold text-[#101828]">My Account Profile</h2>
        <p className="mb-5 mt-1 text-[12px] text-[#667085]">à¦¨à¦¿à¦œà§‡à¦° account information à¦“ profile image à¦ªà¦°à¦¿à¦¬à¦°à§à¦¤à¦¨ à¦•à¦°à§à¦¨à¥¤</p>

        <form onSubmit={handleProfileSubmit}>
          <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl bg-[#F8FAFC] p-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#EAF0FF] text-2xl font-black text-[#2554C7] shadow-sm">
              {imagePreview ? (
                <img src={imagePreview} alt="Profile preview" className="h-full w-full object-cover" />
              ) : (
                profile.name?.charAt(0).toUpperCase() || "U"
              )}
            </div>
            <div>
              <label className="inline-flex cursor-pointer rounded-full border border-[#D0D5DD] bg-white px-4 py-2 text-xs font-bold text-[#344054] hover:border-[#2554C7] hover:text-[#2554C7]">
                Choose Profile Image
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleImageChange} />
              </label>
              <div className="mt-1.5 text-[11px] text-[#667085]">JPG, PNG, WEBP à¦¬à¦¾ GIF Â· à¦¸à¦°à§à¦¬à§‹à¦šà§à¦š 5 MB</div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full Name">
              <input required className="input" value={profile.name} onChange={(e) => setProfile((old) => ({ ...old, name: e.target.value }))} />
            </Field>
            <Field label="Phone Number">
              <input required type="tel" className="input" value={profile.phone} onChange={(e) => setProfile((old) => ({ ...old, phone: e.target.value }))} />
            </Field>
            <Field label="Email">
              <input type="email" required className="input" value={profile.email} onChange={(e) => setProfile((old) => ({ ...old, email: e.target.value }))} />
            </Field>
            <Field label="à¦ªà¦¦à¦¬à§€">
              <input className="input" value={profile.designation} onChange={(e) => setProfile((old) => ({ ...old, designation: e.target.value }))} />
            </Field>
            <Field label="Center">
              <input className="input" value={profile.center} onChange={(e) => setProfile((old) => ({ ...old, center: e.target.value }))} />
            </Field>
          </div>

          {profileMessage && (
            <div className={`mt-4 rounded-lg px-3 py-2 text-xs font-medium ${profileMessage.type === "error" ? "bg-[#FEF3F2] text-[#D92D20]" : "bg-[#ECFDF3] text-[#027A48]"}`}>
              {profileMessage.text}
            </div>
          )}

          <button type="submit" disabled={profileBusy} className="mt-4 rounded-full bg-[#027A48] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#05603A] disabled:opacity-60">
            {profileBusy ? "Saving..." : "Save Profile"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-[#E4E7EC] bg-white p-5">
        <h2 className="text-sm font-bold text-[#101828]">Change Password</h2>
        <p className="mb-4 mt-1 text-[12px] text-[#667085]">à¦¨à¦¿à¦œà§‡à¦° account password à¦ªà¦°à¦¿à¦¬à¦°à§à¦¤à¦¨ à¦•à¦°à§à¦¨à¥¤</p>

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

function CredentialFieldsSection({ title, category, fields, onBack, onLoggedOut }) {
  const [values, setValues] = useState({});
  const [hasValue, setHasValue] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState(null);

  useEffect(() => {
    listSettings()
      .then((response) => {
        const nextValues = {};
        const nextHasValue = {};
        fields.forEach((f) => {
          nextValues[f.key] = f.defaultValue || "";
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
        setError("Settings à¦²à§‹à¦¡ à¦•à¦°à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤");
      })
      .finally(() => setLoading(false));
  }, [category, fields, onLoggedOut]);

  function setFieldValue(key, value) {
    setValues((current) => ({ ...current, [key]: value })); // No need to setSaved(false) here, autosave hook handles it
  }

  const saveCredentials = useCallback(async (currentValues) => {
    setError(""); // Clear previous errors before saving
    try {
      const payload = fields.map((f) => ({
        key: f.key,
        label: f.label,
        category,
        is_secret: f.is_secret,
        value: currentValues[f.key] || "",
      }));
      const response = await replaceSettings(payload);
      // Update hasValue and values based on the response, especially for secrets
      const nextHasValue = {};
      const nextValues = { ...currentValues }; // Start with current values
      response.data.forEach((s) => {
        if (fields.some((f) => f.key === s.key)) {
          nextHasValue[s.key] = s.has_value;
          if (s.is_secret) {
            // For secrets, if it has a value, we don't display it, so keep currentValues[s.key]
            // If it doesn't have a value, it means it was cleared, so set to empty string
            if (!s.has_value) nextValues[s.key] = "";
          } else {
            // For non-secrets, update with the actual value from the response
            if (s.value !== undefined && s.value !== null) {
              nextValues[s.key] = s.value;
            }
          }
        }
      });
      setHasValue(nextHasValue);
      setValues(nextValues);
      return nextValues;
    } catch (requestError) {
      throw new Error(requestError.response?.data?.detail || "Settings save à¦•à¦°à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤"); // Throw error for useAutosave to catch
    }
  }, [category, fields]);

  const { isSaving, isSaved, saveError, triggerSave } = useAutosave(values, saveCredentials, 1000, !loading);

  async function handleManualSave() {
    await triggerSave();
    reloadPage({ settingsActiveSetting: category });
  }

  async function handleTestEmail() {
    if (!testEmail.trim()) {
      setTestMessage({ type: "error", text: "à¦¯à§‡ email-à¦ test à¦ªà¦¾à¦ à¦¾à¦¬à§‡à¦¨ à¦¸à§‡à¦Ÿà¦¿ à¦²à¦¿à¦–à§à¦¨à¥¤" });
      return;
    }
    setTesting(true);
    setTestMessage(null);
    try {
      await triggerSave();
      const response = await sendTestEmail(testEmail.trim());
      setTestMessage({ type: "success", text: `âœ“ ${response.data.message}` });
    } catch (requestError) {
      setTestMessage({
        type: "error",
        text: requestError.response?.data?.detail || requestError.message || "Test email à¦ªà¦¾à¦ à¦¾à¦¨à§‹ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤",
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-3 py-3">
      <button onClick={onBack} className="back-button mb-4">
        â† Back to Settings
      </button>

      <section className="rounded-xl border border-[#E4E7EC] bg-white p-5">
        <h2 className="text-sm font-bold text-[#101828]">{title}</h2>

        {loading ? (
          <div className="py-6 text-center text-xs text-[#98A2B3]">à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡â€¦</div>
        ) : (
          <div className="mt-4 flex max-w-md flex-col gap-4">
            {fields.map((f) => (
              <Field key={f.key} label={f.label}>
                <input
                  type={f.is_secret ? "password" : "text"}
                  className="input"
                  placeholder={f.is_secret && hasValue[f.key] ? "â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢ (set â€” à¦–à¦¾à¦²à¦¿ à¦°à¦¾à¦–à¦²à§‡ à¦†à¦—à§‡à¦° value à¦¥à¦¾à¦•à¦¬à§‡)" : ""}
                  value={values[f.key] || ""}
                  onChange={(e) => setFieldValue(f.key, e.target.value)}
                />
              </Field>
            ))}

            {category === "call" && (
              <div className="space-y-3 rounded-xl border border-[#B2CCFF] bg-[#F5F8FF] p-4 text-xs leading-5 text-[#475467]">
                <div>
                  <div className="text-sm font-black text-[#1849A9]">Zoiper Setup â€” à¦§à¦¾à¦ªà§‡ à¦§à¦¾à¦ªà§‡</div>
                  <p className="mt-1">Zoiper à¦¨à¦¿à¦œà§‡ phone service à¦¦à§‡à§Ÿ à¦¨à¦¾à¥¤ à¦†à¦—à§‡ à¦†à¦ªà¦¨à¦¾à¦° PBX/VoIP provider à¦¥à§‡à¦•à§‡ <b>SIP Username, SIP Password à¦à¦¬à¦‚ SIP Domain/Host</b> à¦¸à¦‚à¦—à§à¦°à¦¹ à¦•à¦°à§à¦¨à¥¤</p>
                </div>

                <ol className="list-decimal space-y-2 pl-4">
                  <li><b>à¦ªà§à¦°à¦¤à¦¿à¦Ÿà¦¿ communicator-à¦à¦° device-à¦ Zoiper install à¦•à¦°à§à¦¨à¥¤</b> Android/iPhone/Desktopâ€”à¦¯à§‡ device à¦¥à§‡à¦•à§‡ call à¦•à¦°à¦¬à§‡ à¦¸à§‡à¦–à¦¾à¦¨à§‡ install à¦•à¦°à¦¤à§‡ à¦¹à¦¬à§‡à¥¤</li>
                  <li><b>Zoiper â†’ Add Account â†’ SIP Account</b> à¦–à§à¦²à§‡ provider-à¦à¦° Username, Password à¦“ Domain/Host à¦¦à¦¿à¦¨à¥¤ Account status <b className="text-emerald-700">Registered</b> à¦¹à¦“à§Ÿà¦¾ à¦ªà¦°à§à¦¯à¦¨à§à¦¤ à¦…à¦ªà§‡à¦•à§à¦·à¦¾ à¦•à¦°à§à¦¨à¥¤</li>
                  <li>Zoiper à¦¥à§‡à¦•à§‡ à¦à¦•à¦Ÿà¦¿ test number dial à¦•à¦°à§‡ incoming/outgoing call à¦•à¦¾à¦œ à¦•à¦°à¦›à§‡ à¦•à¦¿ à¦¨à¦¾ à¦¨à¦¿à¦¶à§à¦šà¦¿à¦¤ à¦•à¦°à§à¦¨à¥¤</li>
                  <li>Browser-à¦ à¦ªà§à¦°à¦¥à¦®à¦¬à¦¾à¦° Call button à¦šà¦¾à¦ªà¦²à§‡ à¦•à§‹à¦¨ app à¦¦à¦¿à§Ÿà§‡ link à¦–à§à¦²à¦¬à§‡ à¦œà¦¿à¦œà§à¦žà§‡à¦¸ à¦•à¦°à¦²à§‡ <b>Zoiper</b> à¦¨à¦¿à¦°à§à¦¬à¦¾à¦šà¦¨ à¦•à¦°à§‡ â€œAlways allow/Rememberâ€ à¦¦à¦¿à¦¨à¥¤</li>
                </ol>

                <div className="rounded-lg border border-blue-100 bg-white p-3">
                  <div className="mb-2 font-black text-[#1849A9]">à¦à¦‡ form-à¦ à¦•à§€ à¦²à¦¿à¦–à¦¬à§‡à¦¨</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div><b>Provider Name</b><br/><code>Zoiper</code></div>
                    <div><b>Country Code</b><br/><code>+880</code></div>
                    <div className="sm:col-span-2"><b>à¦¸à¦¹à¦œ/default setup</b><br/><code>tel:{"{phone}"}</code><br/><span className="text-[10px]">Device-à¦à¦° default dialer/Zoiper link handler à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦° à¦•à¦°à¦¬à§‡à¥¤</span></div>
                    <div className="sm:col-span-2"><b>Direct SIP setup</b><br/><code>sip:{"{phone}"}@pbx.example.com</code><br/><span className="text-[10px]"><code>pbx.example.com</code>-à¦à¦° à¦œà¦¾à§Ÿà¦—à¦¾à§Ÿ à¦†à¦ªà¦¨à¦¾à¦° SIP domain à¦²à¦¿à¦–à§à¦¨à¥¤</span></div>
                  </div>
                  <p className="mt-2 text-[10px] text-slate-500"><b>{"{phone}"}</b> à¦ªà¦°à¦¿à¦¬à¦°à§à¦¤à¦¨ à¦•à¦°à¦¬à§‡à¦¨ à¦¨à¦¾â€”software à¦¸à§‡à¦–à¦¾à¦¨à§‡ guest-à¦à¦° number à¦¬à¦¸à¦¾à¦¬à§‡à¥¤ Zoiper-only setup-à¦ Account SID, Auth Token à¦“ API Key à¦ªà§à¦°à§Ÿà§‹à¦œà¦¨ à¦¨à§‡à¦‡; à¦¸à§‡à¦—à§à¦²à§‹ à¦–à¦¾à¦²à¦¿ à¦°à¦¾à¦–à§à¦¨à¥¤</p>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <b className="text-amber-800">Test à¦•à¦°à¦¾à¦° à¦¨à¦¿à§Ÿà¦®:</b> Settings save à¦¹à¦“à§Ÿà¦¾à¦° à¦ªà¦° Tasks â†’ Pending/Follow-ups â†’ lead à¦–à§à¦²à§à¦¨ â†’ <b>Call via Zoiper</b> à¦šà¦¾à¦ªà§à¦¨à¥¤ à¦­à§à¦² app à¦–à§à¦²à¦²à§‡ device-à¦à¦° default link/dialer setting à¦¥à§‡à¦•à§‡ Zoiper à¦¨à¦¿à¦°à§à¦¬à¦¾à¦šà¦¨ à¦•à¦°à§à¦¨à¥¤
                </div>

                <div className="rounded-lg bg-white px-3 py-2 font-semibold text-[#344054]">
                  Call à¦¶à§‡à¦· à¦¹à¦“à§Ÿà¦¾à¦° event browser à¦¸à¦°à¦¾à¦¸à¦°à¦¿ à¦œà¦¾à¦¨à¦¤à§‡ à¦ªà¦¾à¦°à§‡ à¦¨à¦¾à¥¤ à¦¤à¦¾à¦‡ call à¦¶à§‡à¦·à§‡ task form-à¦ Received/Not Received, duration à¦“ note à¦¦à¦¿à§Ÿà§‡ <b>Save Call Log</b> à¦šà¦¾à¦ªà§à¦¨à¥¤
                </div>

                <div className="text-[10px] text-slate-500">
                  à¦…à¦¨à§à¦¯ softphone à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦° à¦•à¦°à¦¤à§‡ à¦šà¦¾à¦‡à¦²à§‡ à¦¤à¦¾à¦° supported URI schemeâ€”à¦¯à§‡à¦®à¦¨ <code>sip:</code>, <code>sips:</code>, <code>tel:</code>, <code>callto:</code> à¦¬à¦¾ <code>zoiper:</code>â€”à¦¦à¦¿à§Ÿà§‡ template à¦²à¦¿à¦–à¦¤à§‡ à¦ªà¦¾à¦°à¦¬à§‡à¦¨à¥¤
                </div>
              </div>
            )}

            {(error || saveError) && (
              <div className="rounded-lg bg-[#FEF3F2] px-3 py-2 text-xs text-[#D92D20]">
                {error || saveError}
              </div>
            )}

            {category === "email" && (
              <div className="rounded-xl border border-[#B2CCFF] bg-[#F5F8FF] p-4">
                <div className="text-sm font-bold text-[#1849A9]">SMTP à¦ªà¦°à§€à¦•à§à¦·à¦¾ à¦•à¦°à§à¦¨</div>
                <p className="mt-1 text-xs leading-5 text-[#475467]">
                  Gmail à¦¹à¦²à§‡ Host <b>smtp.gmail.com</b>, Port <b>587</b> à¦à¦¬à¦‚ à¦¸à¦¾à¦§à¦¾à¦°à¦£ password-à¦à¦° à¦¬à¦¦à¦²à§‡ Google App Password à¦¦à¦¿à¦¨à¥¤
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="email"
                    className="input flex-1"
                    placeholder="Test recipient email"
                    value={testEmail}
                    onChange={(event) => setTestEmail(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleTestEmail}
                    disabled={testing || isSaving}
                    className="rounded-lg bg-[#155EEF] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
                  >
                    {testing ? "Sending..." : "Save & Send Test"}
                  </button>
                </div>
                {testMessage && (
                  <div className={`mt-3 rounded-lg px-3 py-2 text-xs font-semibold ${
                    testMessage.type === "success" ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[#FEF3F2] text-[#D92D20]"
                  }`}>
                    {testMessage.text}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleManualSave}
                disabled={isSaving}
                className="self-start rounded-full bg-[#027A48] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#05603A] disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              {isSaving && <span className="text-xs font-semibold text-[#2554C7]">Saving changes...</span>}
              {!isSaving && isSaved && <span className="text-xs font-semibold text-[#027A48]">âœ“ Saved</span>}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">{label}</span>
      {children}
      <style>{`
        .input {
          width: 100%;
          border: 1px solid #E4E7EC;
          border-radius: 8px;
          padding: 9px 11px;
          font-size: 13px;
          outline: none;
          background: #ffffff;
        }
        .input:focus {
          border-color: #2554C7;
          box-shadow: 0 0 0 3px #EEF4FF;
        }
      `}</style>
    </label>
  );
}
