import { useEffect, useState } from "react";
import { listFields, replaceFields } from "../../../api/guest.js";
import { reloadPage } from "../../../utils/reload.js";
import { useRealtimeRefresh } from "../../../realtime/RealtimeContext.jsx";

const TYPES = ["text", "tel", "email", "textarea", "select", "dropdown", "date", "number", "checkbox"];

function makeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const emptyDraft = { key: "", label: "", type: "text", placeholder: "", required: false, options: [] };

export default function FieldsTab({ projectId }) {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [editingIndex, setEditingIndex] = useState(null); // null = closed, -1 = adding new
  const [draft, setDraft] = useState(emptyDraft);
  const [optionsText, setOptionsText] = useState("");

  useEffect(() => {
    listFields(projectId)
      .then((res) => setFields(res.data))
      .finally(() => setLoading(false));
  }, [projectId]);

  useRealtimeRefresh(["form_fields"], () => {
    if (editingIndex === null) {
      listFields(projectId).then((res) => setFields(res.data));
    }
  });

  function markDirty() {
    setSaved(false);
  }

  function openAdd() {
    setDraft(emptyDraft);
    setOptionsText("");
    setEditingIndex(-1);
  }

  function openEdit(i) {
    const f = fields[i];
    setDraft({ ...f });
    setOptionsText((f.options || []).join(","));
    setEditingIndex(i);
  }

  function closeEditor() {
    setEditingIndex(null);
  }

  function confirmDraft() {
    const key = makeKey(draft.key || draft.label);
    if (!draft.label.trim() || !key) {
      setError("Label এবং Key দিন।");
      return;
    }
    const isDropdown = draft.type === "select" || draft.type === "dropdown";
    const options = isDropdown ? optionsText.split(",").map((s) => s.trim()).filter(Boolean) : [];
    if (isDropdown && options.length === 0) {
      setError("Dropdown field হলে অন্তত একটি option দিন।");
      return;
    }
    const dupIndex = fields.findIndex((f, i) => f.key === key && i !== editingIndex);
    if (dupIndex !== -1) {
      setError("এই Field Key ইতিমধ্যে ব্যবহার হচ্ছে।");
      return;
    }
    setError("");

    const nextField = { ...draft, key, options, placeholder: draft.placeholder || draft.label };

    setFields((prev) => {
      const next = [...prev];
      if (editingIndex === -1) next.push(nextField);
      else next[editingIndex] = { ...next[editingIndex], ...nextField };
      return next;
    });
    markDirty();
    setEditingIndex(null);
  }

  function removeField(i) {
    if (!confirm(`"${fields[i].label}" ফিল্ড মুছে ফেলবেন?`)) return;
    setFields((prev) => prev.filter((_, idx) => idx !== i));
    markDirty();
  }

  function move(i, dir) {
    setFields((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    markDirty();
  }

  function toggleRequired(i) {
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, required: !f.required } : f)));
    markDirty();
  }

  async function handleSaveAll() {
    setSaving(true);
    try {
      const payload = fields.map(({ key, label, type, placeholder, required, options }) => ({
        key,
        label,
        type,
        placeholder,
        required,
        options,
      }));
      const res = await replaceFields(projectId, payload);
      setFields(res.data);
      setSaved(true);
      reloadPage({ projectEditorTab: "fields" });
    } catch (err) {
      setError(err.response?.data?.detail || "সংরক্ষণ করা যায়নি।");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="py-10 text-center text-sm text-[#667085]">লোড হচ্ছে…</div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-[#E4E7EC] bg-white p-5">
        <div className="mb-3.5 flex items-center justify-between">
          <div className="text-sm font-bold text-[#101828]">Form Fields</div>
          <button onClick={openAdd} className="rounded-full bg-[#EEF4FF] px-3.5 py-1.5 text-xs font-bold text-[#17368F] hover:bg-[#DBEAFE]">
            + Add Field
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {fields.map((f, i) => (
            <div key={f.key + i} className="flex items-center gap-2.5 rounded-lg border border-[#E4E7EC] px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-bold text-[#101828]">{f.label}</span>
                  <span className="rounded-full bg-[#EEF4FF] px-2 py-0.5 text-[10px] font-bold text-[#17368F]">{f.type}</span>
                </div>
                <span className="font-mono text-[11px] text-[#98A2B3]">{f.key}</span>
              </div>
              <label className="flex flex-shrink-0 items-center gap-1.5 text-[11px] text-[#667085]">
                <input type="checkbox" checked={f.required} onChange={() => toggleRequired(i)} />
                Required
              </label>
              <div className="flex flex-shrink-0 gap-1">
                <IconBtn onClick={() => openEdit(i)} title="Edit">✎</IconBtn>
                <IconBtn onClick={() => move(i, -1)} disabled={i === 0} title="Move up">↑</IconBtn>
                <IconBtn onClick={() => move(i, 1)} disabled={i === fields.length - 1} title="Move down">↓</IconBtn>
                <IconBtn onClick={() => removeField(i)} title="Delete" danger>🗑</IconBtn>
              </div>
            </div>
          ))}
          {fields.length === 0 && <div className="py-6 text-center text-xs text-[#98A2B3]">কোনো field নেই।</div>}
        </div>
      </div>

      {editingIndex !== null && (
        <div className="rounded-xl border-l-[3px] border-l-[#2554C7] bg-[#EEF4FF] p-5">
          <div className="mb-3 text-sm font-bold text-[#101828]">{editingIndex === -1 ? "নতুন Field" : "Field সম্পাদনা"}</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Label">
              <input className="input" value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} />
            </Field>
            <Field label="Key">
              <input className="input font-mono" value={draft.key} onChange={(e) => setDraft((d) => ({ ...d, key: e.target.value }))} placeholder="auto from label if empty" />
            </Field>
            <Field label="Type">
              <select className="input" value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Placeholder">
              <input className="input" value={draft.placeholder} onChange={(e) => setDraft((d) => ({ ...d, placeholder: e.target.value }))} />
            </Field>
            {(draft.type === "select" || draft.type === "dropdown") && (
              <Field label="Options (comma separated)">
                <input className="input" value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder="Option A, Option B" />
              </Field>
            )}
            <label className="col-span-2 flex items-center gap-2 text-xs font-semibold text-[#344054]">
              <input type="checkbox" checked={draft.required} onChange={(e) => setDraft((d) => ({ ...d, required: e.target.checked }))} />
              Required field
            </label>
          </div>
          {error && <div className="mt-2 text-xs font-medium text-[#D92D20]">{error}</div>}
          <div className="mt-3 flex gap-2">
            <button onClick={confirmDraft} className="rounded-full bg-[#2554C7] px-4 py-2 text-xs font-bold text-white hover:bg-[#17368F]">
              {editingIndex === -1 ? "Add" : "Update"}
            </button>
            <button onClick={closeEditor} className="rounded-full border border-[#D0D5DD] px-4 py-2 text-xs font-semibold text-[#344054]">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={handleSaveAll} disabled={saving} className="rounded-full bg-[#027A48] px-5 py-2.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60">
          {saving ? "Saving…" : "Save Field Changes"}
        </button>
        {saved && <span className="text-xs font-semibold text-[#027A48]">✓ Saved</span>}
      </div>

      <style>{`
        .input { width: 100%; border: 1px solid #E4E7EC; border-radius: 8px; padding: 9px 11px; font-size: 13px; outline: none; background: #fff; }
        .input:focus { border-color: #2554C7; box-shadow: 0 0 0 3px #EEF4FF; }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">{label}</span>
      {children}
    </label>
  );
}

function IconBtn({ children, onClick, disabled, title, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex h-7 w-7 items-center justify-center rounded-md border border-[#E4E7EC] text-xs text-[#667085] disabled:opacity-30 ${
        danger ? "hover:border-[#D92D20] hover:text-[#D92D20]" : "hover:border-[#2554C7] hover:text-[#2554C7]"
      }`}
    >
      {children}
    </button>
  );
}
