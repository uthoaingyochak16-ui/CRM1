// frontend/src/components/SortDropdown.jsx
export default function SortDropdown({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-[#E4E7EC] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#344054]"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}