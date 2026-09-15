export default function LimitReachedModal({ message, onClose }) {
  if (!message) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl">⚠</div>
        <h2 className="text-lg font-black text-slate-900">Daily Limit Reached</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{message}</p>
        <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-bold leading-5 text-amber-800">
          Limit increase করুন, অথবা task/follow-up পরবর্তী সময় বা পরবর্তী দিনের জন্য set করুন।
        </div>
        <button onClick={onClose} className="mt-5 w-full rounded-xl bg-amber-500 py-2.5 text-sm font-black text-white hover:bg-amber-600">
          বুঝেছি
        </button>
      </div>
    </div>
  );
}
