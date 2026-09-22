import { useEffect, useState } from "react";
import { listCustomerFields, replaceCustomerFields } from "../../../api/guest.js";
import { reloadPage } from "../../../utils/reload.js";
import { useRealtimeRefresh } from "../../../realtime/realtimeHooks.js";

const FIELD_TYPES = ["text", "tel", "email", "textarea", "select", "dropdown", "date", "number", "checkbox"];

function makeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const emptyDraft = { key: "", label: "", type: "text", options: "" };

export default function CustomerFieldsTab() {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingIndex, setEditingIndex] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listCustomerFields()
      .then((res) => setFields(res.data))
      .catch(() => setError("Guest profile fields à¦²à§‹à¦¡ à¦•à¦°à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤"))
      .finally(() => setLoading(false));
  }, []);

  useRealtimeRefresh(["customer_fields"], () => {
    if (editingIndex === null) {
      listCustomerFields().then((res) => setFields(res.data));
    }
  });

  function openAdd() {
    setDraft(emptyDraft);
    setEditingIndex(-1);
    setError("");
    setSaved(false);
  }

  function openEdit(index) {
    const field = fields[index];
    setDraft({
      key: field.key,
      label: field.label,
      type: field.type,
      options: (field.options || []).join(", "),
    });
    setEditingIndex(index);
    setError("");
    setSaved(false);
  }

  function closeEditor() {
    setEditingIndex(null);
    setDraft(emptyDraft);
    setError("");
  }

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function removeField(index) {
    if (!confirm(`"${fields[index].label}" field à¦®à§à¦›à§‡ à¦«à§‡à¦²à¦¬à§‡à¦¨?`)) return;
    setFields((current) => current.filter((_, idx) => idx !== index));
    setSaved(false);
  }

  async function handleSaveFields() {
    setError("");
    const nextFields = fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      options: field.options || [],
    }));
    if (editingIndex !== null) {
      const key = makeKey(draft.key || draft.label);
      if (!draft.label.trim() || !key) {
        setError("Label à¦à¦¬à¦‚ Key à¦‰à¦­à¦¯à¦¼à¦‡ à¦¦à¦¿à¦¨à¥¤");
        return;
      }
      const options = draft.type === "select"
        ? draft.options.split(",").map((item) => item.trim()).filter(Boolean)
        : [];
      const duplicate = nextFields.findIndex((field, idx) => field.key === key && idx !== editingIndex);
      if (duplicate !== -1) {
        setError("à¦à¦‡ Key à¦‡à¦¤à¦¿à¦®à¦§à§à¦¯à§‡à¦‡ à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦° à¦¹à¦šà§à¦›à§‡à¥¤");
        return;
      }
      const nextField = { key, label: draft.label.trim(), type: draft.type, options };
      if (editingIndex === -1) {
        nextFields.push(nextField);
      } else {
        nextFields[editingIndex] = nextField;
      }
    }

    setSaving(true);
    try {
      const res = await replaceCustomerFields(nextFields);
      setFields(res.data);
      setSaved(true);
      closeEditor();
      reloadPage();
    } catch (err) {
      setError(err.response?.data?.detail || "Guest fields à¦¸à¦‚à¦°à¦•à§à¦·à¦£ à¦•à¦°à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-[#E4E7EC] bg-white p-5">
        <div className="text-sm font-bold text-[#101828]">Guest Profile Fields</div>
        <div className="mt-5 text-xs text-[#667085]">à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡â€¦</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-white p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-[#101828]">Guest Profile Fields</div>
          <div className="mt-1 text-xs text-[#667085]">à¦à¦‡ fields à¦—à§à¦²à§‹ Guest profile à¦ à¦¯à§‹à¦— à¦•à¦°à¦¾ à¦¹à¦¬à§‡à¥¤</div>
        </div>
        <button onClick={openAdd} className="rounded-full bg-[#EEF4FF] px-3.5 py-1.5 text-xs font-bold text-[#17368F] hover:bg-[#DBEAFE]">
          + Add Field
        </button>
      </div>

      {fields.length === 0 ? (
        <div className="rounded-xl border border-[#F1F2F4] bg-[#FCFCFD] p-5 text-sm text-[#667085]">
          à¦•à§‹à¦¨à§‹ guest profile field à¦à¦–à¦¨à¦“ à¦¨à¦¿à¦°à§à¦§à¦¾à¦°à¦¿à¦¤ à¦¹à¦¯à¦¼à¦¨à¦¿à¥¤ Add Field à¦•à¦°à¦²à§‡ address, occupation, note à¦‡à¦¤à§à¦¯à¦¾à¦¦à¦¿ save à¦•à¦°à¦¤à§‡ à¦ªà¦¾à¦°à¦¬à§‡à¦¨à¥¤
        </div>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={field.key} className="flex flex-col gap-2 rounded-xl border border-[#E4E7EC] bg-[#FAFBFD] p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#101828]">
                <span>{field.label}</span>
                <span className="rounded-full bg-[#EEF4FF] px-2 py-0.5 text-[10px] font-bold text-[#17368F]">{field.type}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#667085]">
                <span>Key: {field.key}</span>
                {field.options?.length > 0 && <span>Options: {field.options.join(", ")}</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(index)} className="text-xs font-semibold text-[#2554C7]">Edit</button>
                <button onClick={() => removeField(index)} className="text-xs font-semibold text-[#D92D20]">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingIndex !== null && (
        <div className="mt-5 rounded-xl border border-[#D0D5DD] bg-[#F8FAFF] p-5">
          <div className="mb-3 text-sm font-bold text-[#101828]">{editingIndex === -1 ? "Add New Field" : "Edit Field"}</div>
          <div className="grid grid-cols-2 gap-3.5">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">Label</span>
              <input value={draft.label} onChange={(e) => updateDraft("label", e.target.value)} className="input" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">Key</span>
              <input value={draft.key} onChange={(e) => updateDraft("key", e.target.value)} className="input font-mono" placeholder="auto from label" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">Type</span>
              <select value={draft.type} onChange={(e) => updateDraft("type", e.target.value)} className="input">
                {FIELD_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">Options</span>
              <input
                value={draft.options}
                onChange={(e) => updateDraft("options", e.target.value)}
                className="input"
                placeholder={draft.type === "select" || draft.type === "dropdown" ? "Option 1, Option 2" : "Only for select/dropdown type"}
                disabled={draft.type !== "select" && draft.type !== "dropdown"}
              />
            </label>
          </div>
          {error && <div className="mt-3 rounded-lg bg-[#FEF3F2] px-3 py-2 text-xs text-[#D92D20]">{error}</div>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={handleSaveFields} disabled={saving} className="rounded-full bg-[#2554C7] px-4 py-2 text-xs font-bold text-white hover:bg-[#17368F] disabled:opacity-60">
              {saving ? "Savingâ€¦" : editingIndex === -1 ? "Add Field" : "Save Field"}
            </button>
            <button onClick={closeEditor} disabled={saving} className="rounded-full border border-[#D0D5DD] px-4 py-2 text-xs font-semibold text-[#344054]">
              Cancel
            </button>
            {saved && <span className="self-center text-xs font-semibold text-[#027A48]">âœ“ Saved</span>}
          </div>
        </div>
      )}

      <style>{`
        .input { width: 100%; border: 1px solid #E4E7EC; border-radius: 8px; padding: 9px 11px; font-size: 13px; outline: none; background: #fff; }
        .input:focus { border-color: #2554C7; box-shadow: 0 0 0 3px #EEF4FF; }
      `}</style>
    </div>
  );
}
