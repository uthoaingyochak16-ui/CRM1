// frontend/src/pages/admin/settings/Field.jsx
export default function Field({ label, children }) {
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