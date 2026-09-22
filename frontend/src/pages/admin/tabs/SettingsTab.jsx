import { useCallback, useEffect, useState } from "react";
import {
  createEmailTemplate,
  listEmailTemplates,
  listFields,
  updateEvent,
} from "../../../api/guest.js";
import { CheckCircleIcon, LoaderIcon } from "../../../components/Icons.jsx";
import { useAutosave } from "../../../hooks/useAutosave.js";
import { useRealtimeRefresh } from "../../../realtime/realtimeHooks.js";

const STATIC_KEYWORDS = [
  { tag: "{{registration_details}}", desc: "Success page-à¦à¦° Registration ID, à¦¸à¦¬ form data à¦“ registration time" },
  { tag: "{{customer_name}}", desc: "Guest à¦à¦° à¦ªà§‚à¦°à§à¦£ à¦¨à¦¾à¦®" },
  { tag: "{{mobile}}", desc: "à¦®à§‹à¦¬à¦¾à¦‡à¦² à¦¨à¦®à§à¦¬à¦°" },
  { tag: "{{email}}", desc: "à¦‡à¦®à§‡à¦‡à¦²" },
  { tag: "{{event_title}}", desc: "Event à¦à¦° à¦¶à¦¿à¦°à§‹à¦¨à¦¾à¦®" },
  { tag: "{{event_date}}", desc: "Event à¦à¦° à¦¤à¦¾à¦°à¦¿à¦–" },
  { tag: "{{event_place}}", desc: "Event à¦à¦° à¦¸à§à¦¥à¦¾à¦¨" },
  { tag: "{{reg_id}}", desc: "Registration ID" },
  { tag: "{{slip_no}}", desc: "Slip à¦¨à¦®à§à¦¬à¦°" },
  { tag: "{{amount}}", desc: "Payment amount" },
];

const LEGACY_DEFAULT_MARKERS = [
  "{{reg_id}}",
  "{{customer_name}}",
  "{{event_title}}",
  "{{event_date}}",
  "{{event_place}}",
];

function syncLegacyDefaultFields(html) {
  const source = html || "";
  if (source.includes("{{registration_details}}")) return source;
  if (!LEGACY_DEFAULT_MARKERS.every((marker) => source.includes(marker))) return source;
  return source.replace(
    /(<table[^>]*style="[^"]*font-size:14px[^"]*"[^>]*>)[\s\S]*?(<\/table>)/i,
    "$1{{registration_details}}$2",
  );
}

export default function SettingsTab({ project, onSaved }) {
  const [templates, setTemplates] = useState([]);
  const [fields, setFields] = useState([]);
  const [form, setForm] = useState({
    enable_payment: project.enable_payment || false,
    payment_amount: project.payment_amount ?? 0,
    auto_email_on_registration: project.auto_email_on_registration || false,
    auto_email_on_payment: project.auto_email_on_payment || false,
    email_template_registration: project.email_template_registration || "",
    registration_email_subject: project.registration_email_subject || "",
    registration_email_html: syncLegacyDefaultFields(project.registration_email_html || ""),
    registration_email_cc_enabled: project.registration_email_cc_enabled || false,
    registration_email_cc_list: project.registration_email_cc_list || [],
    email_template_payment: project.email_template_payment || "",
  });
  const [copied, setCopied] = useState("");
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [templateDraft, setTemplateDraft] = useState({ name: "", subject: "", html_body: "" });
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateError, setTemplateError] = useState("");
  const [viewTemplate, setViewTemplate] = useState(null);
  const [viewMode, setViewMode] = useState("preview");
  const [ccDraft, setCcDraft] = useState("");
  const [ccError, setCcError] = useState("");

  useEffect(() => {
    setForm({
      enable_payment: project.enable_payment || false,
      payment_amount: project.payment_amount ?? 0,
      auto_email_on_registration: project.auto_email_on_registration || false,
      auto_email_on_payment: project.auto_email_on_payment || false,
      email_template_registration: project.email_template_registration || "",
      registration_email_subject: project.registration_email_subject || "",
      registration_email_html: syncLegacyDefaultFields(project.registration_email_html || ""),
      registration_email_cc_enabled: project.registration_email_cc_enabled || false,
      registration_email_cc_list: project.registration_email_cc_list || [],
      email_template_payment: project.email_template_payment || "",
    });
  }, [project]);

  useEffect(() => { // This useEffect should only run once on mount or when project.id changes
    listEmailTemplates().then((r) => setTemplates(r.data));
    listFields(project.id).then((r) => setFields(r.data));
  }, [project.id]);
  useRealtimeRefresh(["email_templates", "form_fields"], () => {
    listEmailTemplates().then((r) => setTemplates(r.data));
    listFields(project.id).then((r) => setFields(r.data));
  });

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  function addCcEmail() {
    const email = ccDraft.trim().toLowerCase();
    if (!email || !email.includes("@") || email.startsWith("@") || email.endsWith("@")) {
      setCcError("à¦à¦•à¦Ÿà¦¿ à¦¸à¦ à¦¿à¦• CC email address à¦²à¦¿à¦–à§à¦¨à¥¤");
      return;
    }
    setCcError("");
    set("registration_email_cc_list", [...new Set([...(form.registration_email_cc_list || []), email])]);
    setCcDraft("");
  }

  function removeCcEmail(email) {
    set("registration_email_cc_list", (form.registration_email_cc_list || []).filter((item) => item !== email));
  }

  const saveSettings = useCallback(async (currentForm) => {
    const res = await updateEvent(project.id, {
      title_part1: project.title_part1 || "", // These fields are from EventTab, but need to be sent with updateEvent
      title_part2: project.title_part2 || "",
      place: project.place || "",
      event_date: project.event_date || null,
      display_date: project.display_date || "",
      display_time: project.display_time || "",
      home_registration_instruction: project.home_registration_instruction || "",
      registration_instruction: project.registration_instruction || "",
      max_registrations: project.max_registrations ?? null,
      ecard_image_remote_url: project.ecard_image_remote_url || "",
      ...currentForm,
      enable_payment: !!currentForm.enable_payment,
      payment_amount: currentForm.payment_amount === "" || currentForm.payment_amount === null ? 0 : parseInt(currentForm.payment_amount, 10),
    });
    onSaved(res.data);
    return currentForm;
  }, [project, onSaved]);

  const { isSaving, isSaved, saveError, triggerSave } = useAutosave(form, saveSettings);

  function copy(tag) {
    navigator.clipboard.writeText(tag);
    setCopied(tag);
    setTimeout(() => setCopied(""), 1500);
  }

  const dynamicKeywords = fields.map((f) => ({
    tag: `{{${f.key}}}`,
    desc: f.label,
  }));
  const allKeywords = [...STATIC_KEYWORDS, ...dynamicKeywords];
  const previewHtml = allKeywords.reduce(
    (html, keyword) => html.replaceAll(keyword.tag, `[${keyword.desc}]`),
    form.registration_email_html || "",
  );
  const demoValues = {
    registration_details: fields.length
      ? [
          ["Registration ID", "QF-DEMO-2026"],
          ...fields.map((field) => [field.label, `Demo ${field.label}`]),
          ["Registered On", "2026-10-26 10:00 AM"],
        ].map(([label, value], index, rows) =>
          `<tr><td style="padding:10px 0;color:#64748b;${index < rows.length - 1 ? "border-bottom:1px solid #e2e8f0" : ""}">${label}</td><td align="right" style="padding:10px 0;font-weight:bold;${index < rows.length - 1 ? "border-bottom:1px solid #e2e8f0" : ""}">${value}</td></tr>`
        ).join("")
      : '<tr><td style="padding:10px 0;color:#64748b">Registration ID</td><td align="right" style="padding:10px 0;font-weight:bold">QF-DEMO-2026</td></tr>',
    customer_name: "Demo Participant",
    mobile: "01712345678",
    email: "participant@example.com",
    event_title: `${project.title_part1 || "Health and Happiness"} ${project.title_part2 || "Seminar"}`.trim(),
    event_date: project.display_date || "26 October 2026",
    event_place: project.place || "Mohakhali Center",
    reg_id: "QF-DEMO-2026",
    slip_no: "QF-DEMO-2026",
    amount: project.payment_amount || "500",
  };
  fields.forEach((field) => {
    demoValues[field.key] = `Demo ${field.label}`;
  });

  function renderDemoTemplate(html, includeAutomaticDetails = true) {
    const detailsBlock = `
      <div style="margin:24px 0;padding:18px;border:1px solid #e2e8f0;border-radius:14px;background:#fff">
        <h2 style="margin:0 0 10px;color:#0f172a;font-size:16px">Registration Details</h2>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px">
          ${demoValues.registration_details}
        </table>
      </div>`;
    let source = syncLegacyDefaultFields(html || "");
    if (includeAutomaticDetails && !source.includes("{{registration_details}}")) {
      source = /<\/body>/i.test(source)
        ? source.replace(/<\/body>/i, `${detailsBlock}</body>`)
        : `${source}${detailsBlock}`;
    }
    return Object.entries(demoValues).reduce(
      (result, [key, value]) => result.replaceAll(`{{${key}}}`, String(value)),
      source,
    );
  }

  async function handleCreateTemplate(event) {
    event.preventDefault();
    if (!templateDraft.name.trim()) {
      setTemplateError("Template name à¦¦à¦¿à¦¨à¥¤");
      return;
    }
    setTemplateSaving(true);
    setTemplateError("");
    try {
      const response = await createEmailTemplate({
        name: templateDraft.name.trim(),
        subject: templateDraft.subject,
        html_body: templateDraft.html_body,
      });
      setTemplates((current) => [...current, response.data].sort((a, b) => a.name.localeCompare(b.name)));
      set("email_template_registration", String(response.data.id));
      setTemplateDraft({ name: "", subject: "", html_body: "" });
      setTemplateEditorOpen(false);
    } catch (error) {
      setTemplateError(error.response?.data?.detail || "Template à¦¤à§ˆà¦°à¦¿ à¦•à¦°à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤");
    } finally {
      setTemplateSaving(false);
    }
  }

  function openTemplateView(template) {
    setViewTemplate(template);
    setViewMode("preview");
  }

  const templateRows = [
    {
      id: "",
      name: "Default Success Card",
      subject: form.registration_email_subject,
      html_body: form.registration_email_html,
      builtIn: true,
    },
    ...templates,
  ];

  return (
    <div className="flex flex-col gap-5">

      {/* Payment */}
      <Card title="Payment" sub="Registration à¦à¦° à¦ªà¦°à§‡ payment gateway à¦ redirect à¦•à¦°à¦¬à§‡à¥¤">
        <div className="flex flex-col gap-4">
          <Toggle
            label="Enable Payment"
            checked={form.enable_payment}
            onChange={(v) => set("enable_payment", v)}
          />
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#667085]">
              Payment Amount (BDT)
            </label>
            <input
              type="number"
              min="0"
              value={form.payment_amount ?? ""}
              onChange={(e) => set("payment_amount", e.target.value)}
              className="input"
              placeholder="100"
            />
          </div>
        </div>
      </Card>

      {/* Automation Triggers */}
      <Card title="Automation Triggers" sub="à¦¨à¦¿à¦°à§à¦¦à¦¿à¦·à§à¦Ÿ event à¦ à¦¸à§à¦¬à¦¯à¦¼à¦‚à¦•à§à¦°à¦¿à¦¯à¦¼à¦­à¦¾à¦¬à§‡ email à¦ªà¦¾à¦ à¦¾à¦¬à§‡à¥¤">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 rounded-lg border border-[#E4E7EC] p-4">
            <Toggle
              label="Auto Email â€” Registration Success"
              checked={form.auto_email_on_registration}
              onChange={(v) => set("auto_email_on_registration", v)}
            />
            {form.auto_email_on_registration && (
              <div className="mt-3 space-y-3 border-t border-[#F1F2F4] pt-3">
                <div className="rounded-xl border border-[#D0D5DD] bg-[#F9FAFB] p-4">
                  <Toggle
                    label="Send CC Copy"
                    checked={form.registration_email_cc_enabled}
                    onChange={(value) => set("registration_email_cc_enabled", value)}
                  />
                  <p className="mt-1 text-[11px] leading-5 text-[#667085]">
                    CC à¦¬à¦¨à§à¦§ à¦¥à¦¾à¦•à¦²à§‡ à¦¨à¦¿à¦šà§‡à¦° list save à¦¥à¦¾à¦•à¦¬à§‡, à¦•à¦¿à¦¨à§à¦¤à§ registration email à¦¤à¦¾à¦¦à§‡à¦° à¦•à¦¾à¦›à§‡ à¦¯à¦¾à¦¬à§‡ à¦¨à¦¾à¥¤
                  </p>
                  {form.registration_email_cc_enabled && (
                    <div className="mt-3">
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="email"
                          value={ccDraft}
                          onChange={(event) => {
                            setCcDraft(event.target.value);
                            setCcError("");
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              addCcEmail();
                            }
                          }}
                          className="input flex-1"
                          placeholder="cc-recipient@example.com"
                        />
                        <button
                          type="button"
                          onClick={addCcEmail}
                          className="rounded-lg bg-[#2554C7] px-4 py-2.5 text-xs font-bold text-white"
                        >
                          + Add CC
                        </button>
                      </div>
                      {ccError && <p className="mt-2 text-[11px] font-semibold text-[#D92D20]">{ccError}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(form.registration_email_cc_list || []).map((email) => (
                          <span key={email} className="inline-flex items-center gap-2 rounded-full border border-[#B2CCFF] bg-[#EEF4FF] px-3 py-1.5 text-[11px] font-semibold text-[#1849A9]">
                            {email}
                            <button
                              type="button"
                              onClick={() => removeCcEmail(email)}
                              aria-label={`Remove ${email}`}
                              className="text-sm font-black text-[#D92D20]"
                            >
                              Ã—
                            </button>
                          </span>
                        ))}
                        {(form.registration_email_cc_list || []).length === 0 && (
                          <span className="text-[11px] text-[#98A2B3]">à¦à¦–à¦¨à§‹ à¦•à§‹à¦¨à§‹ CC recipient à¦¯à§‹à¦— à¦•à¦°à¦¾ à¦¹à§Ÿà¦¨à¦¿à¥¤</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {!form.email_template_registration && (
                  <>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#667085]">
                        Email Subject
                      </label>
                      <input
                        value={form.registration_email_subject}
                        onChange={(e) => set("registration_email_subject", e.target.value)}
                        className="input"
                        placeholder="Registration Successful â€” {{event_title}}"
                      />
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <label className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">
                          Success Email HTML
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowEmailPreview((value) => !value)}
                          className="text-[11px] font-bold text-[#2554C7] hover:underline"
                        >
                          {showEmailPreview ? "Hide Preview" : "Preview"}
                        </button>
                      </div>
                      <textarea
                        rows={14}
                        value={form.registration_email_html}
                        onChange={(e) => set("registration_email_html", e.target.value)}
                        className="input resize-y font-mono text-[11px]"
                        spellCheck={false}
                      />
                    </div>
                    {showEmailPreview && (
                      <iframe
                        title="Registration success email preview"
                        sandbox=""
                        srcDoc={previewHtml}
                        className="h-[520px] w-full rounded-lg border border-[#E4E7EC] bg-white"
                      />
                    )}
                    <p className="text-[11px] leading-relaxed text-[#667085]">
                      Registration à¦¸à¦«à¦² à¦¹à¦²à§‡ guest-à¦à¦° form email address-à¦ à¦à¦‡ card automatically à¦ªà¦¾à¦ à¦¾à¦¨à§‹ à¦¹à¦¬à§‡à¥¤
                      à¦¨à¦¿à¦šà§‡à¦° placeholder tags subject à¦“ HTMLâ€”à¦¦à§à¦‡ à¦œà¦¾à§Ÿà¦—à¦¾à¦¤à§‡à¦‡ à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦° à¦•à¦°à¦¤à§‡ à¦ªà¦¾à¦°à¦¬à§‡à¦¨à¥¤
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-[#E4E7EC] p-4">
            <Toggle
              label="Auto Email â€” Payment Success"
              checked={form.auto_email_on_payment}
              onChange={(v) => set("auto_email_on_payment", v)}
            />
            {form.auto_email_on_payment && (
              <div className="mt-2">
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#667085]">Email Template</label>
                <select value={form.email_template_payment}
                  onChange={(e) => set("email_template_payment", e.target.value)}
                  className="input">
                  <option value="">â€” Template Select à¦•à¦°à§à¦¨ â€”</option>
                  {templates.map((t) => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card title="Registration Email Templates" sub="Template list à¦¥à§‡à¦•à§‡ à¦à¦•à¦Ÿà¦¿ select à¦•à¦°à§à¦¨ à¦…à¦¥à¦¬à¦¾ à¦¨à¦¤à§à¦¨ template à¦¤à§ˆà¦°à¦¿ à¦•à¦°à§à¦¨à¥¤">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-[#344054]">Template Library</div>
            <div className="mt-0.5 text-[11px] text-[#98A2B3]">{templateRows.length} templates</div>
          </div>
          <button
            type="button"
            onClick={() => {
              setTemplateDraft({
                name: "",
                subject: "Registration Successful â€” {{event_title}}",
                html_body: form.registration_email_html,
              });
              setTemplateError("");
              setTemplateEditorOpen(true);
            }}
            className="rounded-full bg-[#2554C7] px-4 py-2 text-xs font-bold text-white hover:bg-[#17368F]"
          >
            + New Template
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#E4E7EC]">
          <div className="grid grid-cols-[minmax(0,1fr)_72px_82px] bg-[#F9FAFB] px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-[#667085]">
            <span>Name</span>
            <span className="text-center">View</span>
            <span className="text-center">Select</span>
          </div>
          {templateRows.map((template) => {
            const templateId = String(template.id);
            const selected = String(form.email_template_registration || "") === templateId;
            return (
              <div
                key={template.builtIn ? "default-template" : template.id}
                className="grid grid-cols-[minmax(0,1fr)_72px_82px] items-center border-t border-[#E4E7EC] px-4 py-3"
              >
                <div className="min-w-0 pr-3">
                  <div className="truncate text-xs font-bold text-[#101828]">{template.name}</div>
                  <div className="mt-0.5 truncate text-[10px] text-[#98A2B3]">
                    {template.subject || "No subject"}
                  </div>
                  {template.builtIn && (
                    <span className="mt-1 inline-block rounded-full bg-[#EEF4FF] px-2 py-0.5 text-[9px] font-bold text-[#2554C7]">
                      Built-in Â· Customizable
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => openTemplateView(template)}
                  className="justify-self-center text-[11px] font-bold text-[#2554C7] hover:underline"
                >
                  View
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={selected}
                  onClick={() => set("email_template_registration", templateId)}
                  className={`relative h-6 w-11 justify-self-center rounded-full transition-colors ${
                    selected ? "bg-[#2554C7]" : "bg-[#D0D5DD]"
                  }`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    selected ? "translate-x-5" : "translate-x-0.5"
                  }`} />
                </button>
              </div>
            );
          })}
        </div>

        {!form.auto_email_on_registration && (
          <p className="mt-3 rounded-lg bg-[#FFFAEB] px-3 py-2 text-[11px] text-[#B54708]">
            Template selected à¦¥à¦¾à¦•à¦²à§‡à¦“ à¦‰à¦ªà¦°à§‡à¦° Auto Email toggle OFF à¦¥à¦¾à¦•à¦²à§‡ registration email à¦ªà¦¾à¦ à¦¾à¦¨à§‹ à¦¹à¦¬à§‡ à¦¨à¦¾à¥¤
          </p>
        )}
      </Card>

      {templateEditorOpen && (
        <Card title="Create New Email Template" sub="à¦¨à¦¾à¦®à¦Ÿà¦¿ template list-à¦ à¦¦à§‡à¦–à¦¾ à¦¯à¦¾à¦¬à§‡à¥¤ HTML-à¦ dynamic placeholder à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦° à¦•à¦°à¦¤à§‡ à¦ªà¦¾à¦°à¦¬à§‡à¦¨à¥¤">
          <form onSubmit={handleCreateTemplate} className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#667085]">Template Name</label>
              <input
                value={templateDraft.name}
                onChange={(event) => setTemplateDraft((draft) => ({ ...draft, name: event.target.value }))}
                className="input"
                placeholder="Welcome Email"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#667085]">Email Subject</label>
              <input
                value={templateDraft.subject}
                onChange={(event) => setTemplateDraft((draft) => ({ ...draft, subject: event.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#667085]">HTML Code</label>
              <textarea
                rows={16}
                value={templateDraft.html_body}
                onChange={(event) => setTemplateDraft((draft) => ({ ...draft, html_body: event.target.value }))}
                className="input resize-y font-mono text-[11px]"
                spellCheck={false}
              />
            </div>
            {templateError && <div className="text-xs font-semibold text-[#D92D20]">{templateError}</div>}
            <div className="flex gap-2">
              <button type="submit" disabled={templateSaving} className="rounded-full bg-[#2554C7] px-5 py-2.5 text-xs font-bold text-white disabled:opacity-60">
                {templateSaving ? "Creatingâ€¦" : "Create Template"}
              </button>
              <button type="button" onClick={() => setTemplateEditorOpen(false)} className="rounded-full border border-[#D0D5DD] px-5 py-2.5 text-xs font-bold text-[#667085]">
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      {viewTemplate && (
        <Card title={viewTemplate.name} sub="Demo registration data à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦° à¦•à¦°à§‡ email-à¦à¦° exact preview à¦¦à§‡à¦–à¦¾à¦¨à§‹ à¦¹à¦šà§à¦›à§‡à¥¤">
          <div className="mb-3 flex w-fit gap-1 rounded-lg bg-[#F1F2F4] p-1">
            <button
              type="button"
              onClick={() => setViewMode("preview")}
              className={`rounded-md px-4 py-1.5 text-xs font-bold ${viewMode === "preview" ? "bg-white text-[#2554C7] shadow-sm" : "text-[#667085]"}`}
            >
              Preview
            </button>
            <button
              type="button"
              onClick={() => setViewMode("code")}
              className={`rounded-md px-4 py-1.5 text-xs font-bold ${viewMode === "code" ? "bg-white text-[#2554C7] shadow-sm" : "text-[#667085]"}`}
            >
              Code
            </button>
          </div>
          <div className="mb-3 rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] px-3 py-2 text-xs">
            <span className="font-bold text-[#344054]">Subject: </span>
            <span className="text-[#667085]">{renderDemoTemplate(viewTemplate.subject, false)}</span>
          </div>
          {viewMode === "preview" ? (
            <iframe
              title={`${viewTemplate.name} preview`}
              sandbox=""
              srcDoc={renderDemoTemplate(viewTemplate.html_body)}
              className="h-[560px] w-full rounded-lg border border-[#E4E7EC] bg-white"
            />
          ) : (
            <pre className="max-h-[560px] overflow-auto whitespace-pre-wrap rounded-lg bg-[#101828] p-4 text-[11px] leading-relaxed text-[#E2E8F0]">
              {viewTemplate.html_body}
            </pre>
          )}
          <button type="button" onClick={() => setViewTemplate(null)} className="mt-3 rounded-full border border-[#D0D5DD] px-4 py-2 text-xs font-bold text-[#667085]">
            Close
          </button>
        </Card>
      )}

      {/* Dynamic Keywords Chart */}
      <Card title="Dynamic Keywords Reference" sub="à¦à¦‡ placeholder à¦—à§à¦²à§‹ HTML template à¦ à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦° à¦•à¦°à§à¦¨à¥¤">
        <div className="overflow-hidden rounded-lg border border-[#E4E7EC]">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-[#F9FAFB]">
                <th className="px-4 py-2.5 text-left font-bold text-[#344054]">Placeholder Tag</th>
                <th className="px-4 py-2.5 text-left font-bold text-[#344054]">Description</th>
                <th className="px-4 py-2.5 text-left font-bold text-[#344054]">Copy</th>
              </tr>
            </thead>
            <tbody>
              {allKeywords.map((kw) => (
                <tr key={kw.tag} className="border-t border-[#F1F2F4]">
                  <td className="px-4 py-2.5 font-mono text-[#2554C7]">{kw.tag}</td>
                  <td className="px-4 py-2.5 text-[#667085]">{kw.desc}</td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => copy(kw.tag)}
                      className="rounded-full bg-[#F1F2F4] px-2.5 py-1 text-[10px] font-semibold text-[#344054] hover:bg-[#EEF4FF] hover:text-[#2554C7]">
                      {copied === kw.tag ? "âœ“ Copied" : "Copy"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex items-center gap-3 mt-5">
        <button type="button" onClick={() => triggerSave()} disabled={isSaving} className="rounded-full bg-[#2554C7] px-5 py-2.5 text-xs font-bold text-white disabled:opacity-60">Save</button>
        {isSaving && (
          <span className="flex items-center gap-1 text-xs font-semibold text-[#667085]">
            <LoaderIcon className="h-3.5 w-3.5 animate-spin" /> Saving...
          </span>
        )}
        {isSaved && (
          <span className="flex items-center gap-1 text-xs font-semibold text-[#027A48]">
            <CheckCircleIcon className="h-3.5 w-3.5" /> Saved
          </span>
        )}
        {saveError && <span className="text-xs font-semibold text-[#D92D20]">{saveError}</span>}

      </div>

      <style>{`.input{width:100%;border:1px solid #E4E7EC;border-radius:8px;padding:9px 12px;font-size:13px;outline:none;background:#fff}.input:focus{border-color:#2554C7;box-shadow:0 0 0 3px #EEF4FF}`}</style>
    </div>
  );
}

function Card({ title, sub, children }) {
  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-white p-5">
      <div className="mb-4 border-b border-[#F1F2F4] pb-3">
        <div className="text-sm font-bold text-[#101828]">{title}</div>
        {sub && <div className="mt-0.5 text-[11px] text-[#667085]">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="text-sm font-semibold text-[#344054]">{label}</span>
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-[#2554C7]" : "bg-[#D0D5DD]"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}
