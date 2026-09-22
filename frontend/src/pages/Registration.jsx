import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient as useQueryGuest } from "@tanstack/react-query";
import useProjectRef, { withProjectParam } from "../hooks/useProjectRef.js";

import { getPublicConfig, submitRegistration } from "../api/guest.js";
import InstructionBox from "../components/InstructionBox.jsx";
import { useRealtimeRefresh } from "../realtime/realtimeHooks.js";


export default function Registration() {
  const projectRef = useProjectRef();
  const navigate = useNavigate();

  const [config, setConfig] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [values, setValues] = useState({});
  const [formError, setFormError] = useState("");



  const queryGuest = useQueryGuest();

  const mutation = useMutation({
    mutationFn: () => submitRegistration(projectRef, values),
    onSuccess: (res) => {
      queryGuest.invalidateQueries({ queryKey: ["registrations"] });

      sessionStorage.setItem(
        `qf_last_registration_${projectRef}`,
        JSON.stringify({
          ...res.data.data,
          reg_id: res.data.reg_id,
          reg_date: res.data.created_at,
          email_sent: Boolean(res.data.email_sent),
          email_status: res.data.email_status || "not_requested",
        })
      );

      navigate(withProjectParam("/register/success", projectRef));
    },
    onError: (err) => {
      sessionStorage.setItem(
        `qf_last_registration_${projectRef}`,
        JSON.stringify({ ...values, reg_id: "" })
      );
      sessionStorage.setItem(
        `qf_error_message_${projectRef}`,
        err.response?.data?.detail || "Server connection failed. Please try again."
      );
      navigate(withProjectParam("/register/error", projectRef));
    },
  });

  const submitting = mutation.isPending;

  const loadConfig = (preserveValues = false) => {
    if (!projectRef) return;
    getPublicConfig(projectRef)
      .then((res) => {
        setConfig(res.data);
        setValues((current) => {
          const initial = {};
          res.data.form_fields.forEach((f) => {
            initial[f.key] = preserveValues ? current[f.key] || "" : "";
          });
          return initial;
        });
      })
      .catch(() => setLoadError("à¦à¦‡ à¦‡à¦­à§‡à¦¨à§à¦Ÿà§‡à¦° à¦¤à¦¥à§à¦¯ à¦–à§à¦à¦œà§‡ à¦ªà¦¾à¦“à¦¯à¦¼à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤"));
  };

  useEffect(() => loadConfig(false), [projectRef]); // eslint-disable-line react-hooks/exhaustive-deps
  useRealtimeRefresh(
    ["projects", "registrations", "form_fields"],
    () => loadConfig(true),
  );

  function setField(key, val) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setFormError("");

    for (const f of config.form_fields) {
      if ((f.required || f.type === "tel") && !String(values[f.key] || "").trim()) {
        setFormError(`"${f.label}" à¦«à¦¿à¦²à§à¦¡à¦Ÿà¦¿ à¦†à¦¬à¦¶à§à¦¯à¦•à¥¤`);
        return;
      }
    }

    mutation.mutate();
  }

  if (!projectRef || loadError) {
    return <Shell><Center text={loadError || "à¦•à§‹à¦¨à§‹ à¦‡à¦­à§‡à¦¨à§à¦Ÿ à¦¨à¦¿à¦°à§à¦¬à¦¾à¦šà¦¨ à¦•à¦°à¦¾ à¦¹à¦¯à¦¼à¦¨à¦¿à¥¤"} /></Shell>;
  }
  if (!config) {
    return <Shell><Center text="à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡â€¦" /></Shell>;
  }
  if (!config.published) {
    return <Shell><Center text="à¦°à§‡à¦œà¦¿à¦¸à§à¦Ÿà§à¦°à§‡à¦¶à¦¨ à¦à¦–à¦¨à§‹ à¦–à§‹à¦²à¦¾ à¦¹à¦¯à¦¼à¦¨à¦¿à¥¤" /></Shell>;
  }
  const seatsFull = Boolean(config.max_registrations) && config.registrations_count >= config.max_registrations;
  if (seatsFull) {
    return <Shell><Center text="ðŸŽŸï¸ à¦¦à§à¦ƒà¦–à¦¿à¦¤, à¦°à§‡à¦œà¦¿à¦¸à§à¦Ÿà§à¦°à§‡à¦¶à¦¨à§‡à¦° à¦¨à¦¿à¦°à§à¦§à¦¾à¦°à¦¿à¦¤ à¦†à¦¸à¦¨ à¦¸à¦‚à¦–à§à¦¯à¦¾ à¦ªà§‚à¦°à§à¦£ à¦¹à¦¯à¦¼à§‡ à¦—à§‡à¦›à§‡à¥¤" /></Shell>;
  }

  return (
    <Shell>
      <div className="border-b border-border bg-bg2 px-6 py-5 text-center">
        <h1 className="font-display text-lg font-black text-ink">
          {config.title_part1} <span className="italic text-accent">{config.title_part2}</span>
        </h1>
        <InstructionBox html={config.registration_instruction} className="mt-3" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-6">
        {config.form_fields.map((f) => (
          <Field key={f.key} field={f} value={values[f.key] || ""} onChange={(v) => setField(f.key, v)} />
        ))}


        {formError && (
          <div className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
            {formError}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 w-full rounded-full bg-accent px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-accent-hover disabled:opacity-60"
        >
          {submitting ? "à¦œà¦®à¦¾ à¦¹à¦šà§à¦›à§‡â€¦" : "à¦°à§‡à¦œà¦¿à¦¸à§à¦Ÿà§à¦°à§‡à¦¶à¦¨ à¦¸à¦®à§à¦ªà¦¨à§à¦¨ à¦•à¦°à§à¦¨"}
        </button>
      </form>
    </Shell>
  );
}

function Field({ field, value, onChange }) {
  const base =
    "w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft";

  const isDropdown = field.type === "select" || field.type === "dropdown";
  const isRequired = field.required || field.type === "tel";
  const normalizedFieldName = `${field.key || ""} ${field.label || ""}`.toLowerCase();
  const placeholder = /remarks?|comment|à¦®à¦¨à§à¦¤à¦¬à§à¦¯/.test(normalizedFieldName)
    ? "à¦†à¦ªà¦¨à¦¾à¦° à¦•à§‹à¦¨à§‹ à¦¸à¦®à¦¸à§à¦¯à¦¾ à¦…à¦¥à¦¬à¦¾ à¦•à§‹à¦¯à¦¼à¦¾à¦¨à§à¦Ÿà¦¾à¦® à¦¸à¦®à§à¦ªà¦°à§à¦•à§‡ à¦•à§‹à¦¨à§‹ à¦®à¦¨à§à¦¤à¦¬à§à¦¯ à¦¥à¦¾à¦•à¦²à§‡ à¦à¦–à¦¾à¦¨à§‡ à¦²à¦¿à¦–à§à¦¨à¥¤"
    : field.placeholder;

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-ink-soft">
        {field.label} {isRequired && <span className="text-danger">*</span>}
      </span>
      {field.type === "textarea" ? (
        <textarea
          className={base}
          rows={3}
          placeholder={placeholder}
          value={value}
          required={isRequired}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : isDropdown ? (
        <select required={isRequired} className={base} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">à¦¨à¦¿à¦°à§à¦¬à¦¾à¦šà¦¨ à¦•à¦°à§à¦¨</option>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : field.type === "checkbox" ? (
        <div className="flex items-center gap-2 py-1">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent-soft cursor-pointer"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="text-sm text-ink">{placeholder || field.label}</span>
        </div>
      ) : (
        <input
          className={base}
          type={
            field.type === "tel"
              ? "tel"
              : field.type === "email"
              ? "email"
              : field.type === "date"
              ? "date"
              : field.type === "number"
              ? "number"
              : "text"
          }
          placeholder={placeholder}
          value={value}
          required={isRequired}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

function Shell({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-6">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
        {children}
      </div>
    </div>
  );
}

function Center({ text }) {
  return <div className="px-6 py-14 text-center text-sm text-muted">{text}</div>;
}
