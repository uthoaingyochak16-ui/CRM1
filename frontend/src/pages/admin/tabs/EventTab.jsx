import { useEffect, useState } from "react";
import { updateEvent, uploadEcard, removeEcard } from "../../../api/guest.js";
import { reloadPage } from "../../../utils/reload.js";
import RichInstructionEditor from "../../../components/RichInstructionEditor.jsx";

function toLocalInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventTab({ project, onSaved }) {
  const [form, setForm] = useState({
    title_part1: project.title_part1 || "",
    title_part2: project.title_part2 || "",
    place: project.place || "",
    event_date: toLocalInputValue(project.event_date),
    display_date: project.display_date || "",
    display_time: project.display_time || "",
    home_registration_instruction: project.home_registration_instruction || "",
    registration_instruction: project.registration_instruction || "",
    max_registrations: project.max_registrations ?? "",
    ecard_image_remote_url: project.ecard_image_remote_url || "",
    enable_payment: project.enable_payment || false,
    payment_amount: project.payment_amount ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    setForm({
      title_part1: project.title_part1 || "",
      title_part2: project.title_part2 || "",
      place: project.place || "",
      event_date: toLocalInputValue(project.event_date),
      display_date: project.display_date || "",
      display_time: project.display_time || "",
      home_registration_instruction: project.home_registration_instruction || "",
      registration_instruction: project.registration_instruction || "",
      max_registrations: project.max_registrations ?? "",
      ecard_image_remote_url: project.ecard_image_remote_url || "",
      enable_payment: project.enable_payment || false,
      payment_amount: project.payment_amount ?? "",
    });
  }, [project]);

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
    setSaved(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    try {
      const res = await updateEvent(project.id, {
        ...form,
        event_date: form.event_date ? new Date(form.event_date).toISOString() : null,
        max_registrations: form.max_registrations === "" ? null : parseInt(form.max_registrations, 10),
        enable_payment: !!form.enable_payment,
        payment_amount: form.payment_amount === "" ? 0 : parseInt(form.payment_amount, 10),
        auto_email_on_registration: project.auto_email_on_registration || false,
        email_template_registration: project.email_template_registration || "",
        registration_email_subject: project.registration_email_subject || "",
        registration_email_html: project.registration_email_html || "",
        auto_email_on_payment: project.auto_email_on_payment || false,
        email_template_payment: project.email_template_payment || "",
      });
      onSaved(res.data);
      setSaved(true);
      reloadPage({ projectEditorTab: "event" });
    } catch (error) {
      const detail = error.response?.data?.detail;
      setSaveError(
        Array.isArray(detail)
          ? detail.map((item) => item.msg).join(", ")
          : detail || "Event save করা যায়নি।",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadEcard(project.id, file);
      onSaved(res.data);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleRemoveImage() {
    if (!confirm("এই event card image-টি remove করবেন?")) return;
    const res = await removeEcard(project.id);
    onSaved(res.data);
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-5">
      <Card title="Title" sub="ইভেন্টের হেডলাইন — দ্বিতীয় অংশ accent রঙে italic দেখানো হবে।">
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="Title Part 1">
            <input value={form.title_part1} onChange={(e) => set("title_part1", e.target.value)} className="input" />
          </Field>
          <Field label="Title Part 2 (accent)">
            <input value={form.title_part2} onChange={(e) => set("title_part2", e.target.value)} className="input" />
          </Field>
        </div>
      </Card>

      <Card title="Date, Time & Place">
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="Event Date & Time (countdown-এর জন্য)">
            <input
              type="datetime-local"
              value={form.event_date}
              onChange={(e) => set("event_date", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Place">
            <input value={form.place} onChange={(e) => set("place", e.target.value)} className="input" />
          </Field>
          <Field label="Display Date (ঐচ্ছিক কাস্টম টেক্সট)">
            <input value={form.display_date} onChange={(e) => set("display_date", e.target.value)} className="input" placeholder="৩০ আগস্ট ২০২৬" />
          </Field>
          <Field label="Display Time (ঐচ্ছিক কাস্টম টেক্সট)">
            <input value={form.display_time} onChange={(e) => set("display_time", e.target.value)} className="input" placeholder="বিকাল ৪টা" />
          </Field>
        </div>
        <p className="mt-2 text-[11px] text-[#98A2B3]">Display Date/Time খালি রাখলে Event Date & Time থেকে স্বয়ংক্রিয়ভাবে দেখানো হবে।</p>
      </Card>

      <Card
        title="Home Page Instruction"
        sub="Home page-এর Registration button-এর উপরে দেখাবে। লম্বা লেখা compact scroll box-এর মধ্যে থাকবে।"
      >
        <RichInstructionEditor
          value={form.home_registration_instruction}
          onChange={(value) => set("home_registration_instruction", value)}
          placeholder="রেজিস্ট্রেশন করার আগে প্রয়োজনীয় নির্দেশনা লিখুন…"
        />
      </Card>

      <Card
        title="Registration Form Instruction"
        sub="Registration form-এর event title-এর ঠিক নিচে দেখাবে।"
      >
        <RichInstructionEditor
          value={form.registration_instruction}
          onChange={(value) => set("registration_instruction", value)}
          placeholder="ফর্ম পূরণের নিয়ম ও প্রয়োজনীয় তথ্য লিখুন…"
        />
      </Card>

      <Card title="Registration Limit" sub="সিট সংখ্যা নির্ধারণ করুন — এই সংখ্যায় পৌঁছালে registration form স্বয়ংক্রিয়ভাবে বন্ধ হয়ে যাবে।">
        <div className="flex items-end gap-3.5">
          <Field label="Max Seats (খালি রাখলে unlimited)">
            <input
              type="number"
              min="0"
              value={form.max_registrations}
              onChange={(e) => set("max_registrations", e.target.value)}
              className="input"
              placeholder="Unlimited"
            />
          </Field>
          <div className="pb-2.5 text-xs font-semibold text-[#667085]">
            এখন পর্যন্ত জমা হয়েছে: <span className="text-[#101828]">{project.registrations_count}</span>
            {project.max_registrations ? ` / ${project.max_registrations}` : ""}
          </div>
        </div>
      </Card>
      <Card title="Payment Amount" sub="Enable Payment চালু থাকলে এই amount টি SSLCommerz এ পাঠানো হবে।">
        <Field label="Amount (BDT)">
          <input
            type="number"
            min="0"
            value={form.payment_amount ?? ""}
            onChange={(e) => set("payment_amount", e.target.value)}
            className="input"
            placeholder="100"
          />
        </Field>
      </Card>

      <Card title="Event Card Image" sub="Local image upload করুন অথবা remote image-এর direct URL ব্যবহার করুন।">
        {project.ecard_image_url && (
          <div className="mb-4 flex items-start gap-4">
            <img
              src={project.ecard_image_url}
              alt="Event card preview"
              className="h-28 w-40 rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] object-contain"
            />
            <button type="button" onClick={handleRemoveImage} className="btn-danger">
              Remove Image
            </button>
          </div>
        )}

        <div className="space-y-4">
          <Field label="Remote Image URL">
            <input
              type="url"
              value={form.ecard_image_remote_url}
              onChange={(e) => set("ecard_image_remote_url", e.target.value)}
              className="input"
              placeholder="https://example.com/event-card.jpg"
            />
          </Field>
          <p className="-mt-2 text-[11px] text-[#98A2B3]">
            Direct image link দিন—URL অবশ্যই http:// অথবা https:// দিয়ে শুরু হতে হবে। এরপর Save Changes চাপুন।
          </p>

          <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-[#98A2B3]">
            <span className="h-px flex-1 bg-[#E4E7EC]" />
            অথবা
            <span className="h-px flex-1 bg-[#E4E7EC]" />
          </div>

          <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed border-[#D0D5DD] bg-[#FAFBFC] px-4 py-6 text-center hover:border-[#2554C7] hover:bg-[#EEF4FF]">
            <span className="text-sm font-semibold text-[#344054]">{uploading ? "আপলোড হচ্ছে…" : "Local image upload করুন"}</span>
            <span className="text-[11px] text-[#98A2B3]">PNG, JPG, WEBP</span>
            <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
          </label>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {saved && <span className="text-xs font-semibold text-[#027A48]">✓ Saved</span>}
        {saveError && <span className="text-xs font-semibold text-[#D92D20]">{saveError}</span>}
      </div>

      <style>{`
        .input { width: 100%; border: 1px solid #E4E7EC; border-radius: 8px; padding: 10px 12px; font-size: 13px; outline: none; }
        .input:focus { border-color: #2554C7; box-shadow: 0 0 0 3px #EEF4FF; }
        .btn-primary { background: #2554C7; color: #fff; font-weight: 700; font-size: 13px; padding: 10px 20px; border-radius: 999px; }
        .btn-primary:hover { background: #17368F; }
        .btn-primary:disabled { opacity: .6; }
        .btn-danger { background: #FEF3F2; color: #D92D20; border: 1px solid #F8B4AC; font-weight: 700; font-size: 12px; padding: 8px 14px; border-radius: 999px; }
      `}</style>
    </form>
  );
}

function Card({ title, sub, children }) {
  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-white p-5">
      <div className="mb-3.5">
        <div className="text-sm font-bold text-[#101828]">{title}</div>
        {sub && <div className="mt-0.5 text-[12px] text-[#667085]">{sub}</div>}
      </div>
      {children}
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
