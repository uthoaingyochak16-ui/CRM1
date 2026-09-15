import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE, getLoginAppearance, login } from "../../api/guest.js";

const DEFAULT_PANEL_IMAGE = "https://i.pinimg.com/736x/d1/0b/44/d10b44153cdc57af0be0f8489ef024eb.jpg";
const DEFAULT_PANEL_TITLE = "Manage everything from one secure dashboard.";
const DEFAULT_PANEL_SUBTITLE = "Registrations, records, and reports — all in one panel.";

/**
 * AdminLogin
 *
 * Props:
 *  - onSuccess(user): called after a successful login
 *  - panelImageSrc?: string — photo/illustration URL for the image panel.
 *    When omitted (or if it fails to load), a built-in illustration is
 *    shown instead, so the panel always looks complete either way.
 *  - panelTitle?, panelSubtitle?: optional text override for the panel
 *
 * The image itself is shown clean, with no color wash over it. Only the
 * text sits on a small frosted chip, and that chip's tint (dark-on-light
 * vs light-on-dark) is picked automatically from the image's brightness
 * right behind where the chip sits — so text stays readable without
 * tinting the whole photo.
 */
export default function AdminLogin({
  onSuccess,
  panelImageSrc,
  panelTitle,
  panelSubtitle,
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedPanelImageSrc, setSavedPanelImageSrc] = useState("");
  const [savedPanelTitle, setSavedPanelTitle] = useState("");
  const [savedPanelSubtitle, setSavedPanelSubtitle] = useState("");

  // null = still deciding / no image; true = that region of the image is
  // dark (use a light glass chip); false = it's light (use a dark glass chip)
  const [zoneIsDark, setZoneIsDark] = useState(null);
  const [imageFailed, setImageFailed] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getLoginAppearance()
      .then((response) => {
        if (cancelled) return;
        const url = response.data?.panel_image_url || "";
        setSavedPanelImageSrc(url && !url.startsWith("http") ? `${API_BASE}${url}` : url);
        setSavedPanelTitle(response.data?.panel_title || "");
        setSavedPanelSubtitle(response.data?.panel_subtitle || "");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const effectivePanelImageSrc = panelImageSrc || savedPanelImageSrc || DEFAULT_PANEL_IMAGE;
  const effectivePanelTitle = panelTitle || savedPanelTitle || DEFAULT_PANEL_TITLE;
  const effectivePanelSubtitle = panelSubtitle || savedPanelSubtitle || DEFAULT_PANEL_SUBTITLE;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await login(username.trim(), password);
      sessionStorage.setItem("qf_admin_token", res.data.access_token);
      sessionStorage.setItem("qf_current_user", JSON.stringify(res.data.user));
      window.dispatchEvent(new Event("qf:auth-changed"));
      onSuccess(res.data.user);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "লগইন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setBusy(false);
    }
  }

  // Sample only the bottom-left region of the image — exactly where the
  // text chip sits — instead of the whole photo, so the reading is accurate
  // for that spot even if the rest of the image is a different tone.
  useEffect(() => {
    setZoneIsDark(null);
    setImageFailed(false);
    if (!effectivePanelImageSrc) return;

    let cancelled = false;
    const img = new window.Image();
    img.referrerPolicy = "no-referrer";

    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = canvasRef.current || document.createElement("canvas");
        canvasRef.current = canvas;
        const size = 24;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        // bottom-left ~60% width, bottom 35% height of the source image
        const sx = 0;
        const sy = img.height * 0.65;
        const sw = img.width * 0.65;
        const sh = img.height * 0.35;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let total = 0;
        for (let i = 0; i < data.length; i += 4) {
          total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        const avg = total / (data.length / 4);
        if (!cancelled) setZoneIsDark(avg < 150);
      } catch {
        if (!cancelled) setZoneIsDark(null);
      }
    };

    img.onerror = () => {
      if (!cancelled) setImageFailed(true);
    };

    img.src = effectivePanelImageSrc;
    return () => {
      cancelled = true;
    };
  }, [effectivePanelImageSrc]);

  const showCustomImage = Boolean(effectivePanelImageSrc) && !imageFailed;
  // Unknown brightness (CORS-blocked read) defaults to a dark-glass chip,
  // since a solid-ish dark chip with white text reads on almost any photo.
  const useLightChip = zoneIsDark === false;

  const chipClasses = useLightChip
    ? "bg-white/75 text-[#101828]"
    : "bg-black/45 text-white";

  const chipSubClasses = useLightChip ? "text-[#344054]" : "text-white/85";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F9FC] px-4 py-6 sm:py-10">
      <div className="grid w-full max-w-[820px] grid-cols-1 overflow-hidden rounded-2xl border border-[#EAECF0] bg-white shadow-[0_8px_30px_-8px_rgba(16,24,40,0.14)] md:grid-cols-[1fr_1fr]">
        {/* ---------- IMAGE / TEXT PANEL ---------- */}
        <div className="relative flex aspect-[4/5] w-full flex-col justify-end overflow-hidden bg-white xs:aspect-[3/4] sm:aspect-[16/10] md:aspect-auto md:h-auto md:min-h-[480px] md:justify-between md:bg-[#2554C7]">
          {showCustomImage ? (
            <div className="absolute inset-4 flex items-center justify-center md:inset-0">
              <img
                src={effectivePanelImageSrc}
                alt="Login panel"
                referrerPolicy="no-referrer"
                loading="eager"
                fetchPriority="high"
                onError={() => setImageFailed(true)}
                className="h-auto max-h-full w-auto max-w-full rounded-2xl border border-[#D0D5DD] object-contain object-center md:h-full md:max-h-none md:w-full md:max-w-none md:rounded-none md:border-0 md:object-cover"
              />
            </div>
          ) : (
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 560" preserveAspectRatio="xMidYMid slice">
              <defs>
                <linearGradient id="panelGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#2f6bdb" />
                  <stop offset="100%" stopColor="#1d4ed8" />
                </linearGradient>
              </defs>
              <rect width="400" height="560" fill="url(#panelGrad)" />
              <circle cx="360" cy="60" r="140" fill="white" opacity="0.06" />
              <circle cx="20" cy="500" r="110" fill="white" opacity="0.06" />
              <circle cx="330" cy="420" r="3" fill="white" opacity="0.5" />
              <circle cx="60" cy="140" r="3" fill="white" opacity="0.4" />
              <circle cx="200" cy="40" r="2.5" fill="white" opacity="0.4" />
            </svg>
          )}

          {/* brand lockup — top-left, own small chip, on ALL breakpoints now */}
          <div className="relative z-10 p-4 pb-0 sm:p-6 sm:pb-0 md:p-9">
            <div
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 backdrop-blur-md ${
                showCustomImage ? chipClasses : "bg-transparent text-white"
              }`}
            >
              <img src="/quantum-favicon.png" alt="Quantum Foundation" className="h-5 w-5 object-contain" />
              <span className="font-display text-sm font-bold">Quantum Foundation</span>
            </div>
          </div>

          {/* illustration — only when there's no usable image */}
          {!showCustomImage && (
            <div className="relative z-10 flex flex-1 items-center justify-center py-4 md:py-6">
              <svg viewBox="0 0 220 190" className="w-full max-w-[160px] md:max-w-[220px]">
                <rect x="30" y="34" width="160" height="112" rx="10" fill="white" opacity="0.10" stroke="white" strokeOpacity="0.3" />
                <rect x="44" y="52" width="64" height="7" rx="3.5" fill="white" opacity="0.5" />
                <rect x="44" y="66" width="96" height="5" rx="2.5" fill="white" opacity="0.28" />
                <rect x="44" y="76" width="80" height="5" rx="2.5" fill="white" opacity="0.28" />
                <circle cx="110" cy="112" r="24" fill="white" />
                <rect x="99" y="108" width="22" height="17" rx="3.5" fill="#2554C7" />
                <path d="M103 108v-6a7 7 0 0 1 14 0v6" stroke="#2554C7" strokeWidth="3.4" fill="none" strokeLinecap="round" />
                <circle cx="110" cy="116" r="2.2" fill="white" />
              </svg>
            </div>
          )}

          {/* text — sits on its own frosted chip, sized to the text, not the whole panel */}
          <div className="relative z-10 p-4 pt-0 sm:p-6 sm:pt-0 md:p-9 md:pt-0">
            <div
              className={`inline-block max-w-[280px] rounded-2xl p-3.5 backdrop-blur-md sm:p-4 ${
                showCustomImage ? chipClasses : "bg-transparent"
              }`}
            >
              <h2 className={`font-display text-[15px] font-bold leading-snug sm:text-base md:text-lg ${!showCustomImage ? "text-white" : ""}`}>
                {effectivePanelTitle}
              </h2>
              <p
                className={`mt-1.5 block text-xs leading-relaxed sm:text-sm ${
                  showCustomImage ? chipSubClasses : "text-white/70"
                }`}
              >
                {effectivePanelSubtitle}
              </p>
            </div>
          </div>
        </div>

        {/* ---------- LOGIN FORM PANEL ---------- */}
        <div className="flex flex-col justify-center px-6 py-7 sm:px-10 sm:py-10">
          <h1 className="font-display text-xl font-black text-[#101828]">Log in</h1>
          <p className="mt-1.5 text-sm text-[#667085]">
            Enter your username and password to continue.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">
                  Username
                </span>
              <div className="relative flex items-center">
                <svg className="pointer-events-none absolute left-3.5 h-4 w-4 text-[#98A2B3]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 18a4 4 0 0 0-8 0" />
                  <circle cx="12" cy="8" r="4" />
                </svg>
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                  placeholder="admin"
                  className="w-full rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] py-2.5 pl-10 pr-3.5 text-sm text-[#101828] outline-none transition focus:border-[#2554C7] focus:bg-white focus:ring-2 focus:ring-[#EEF4FF]"
                />
              </div>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">
                Password
              </span>
              <div className="relative flex items-center">
                <svg className="pointer-events-none absolute left-3.5 h-4 w-4 text-[#98A2B3]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="4" y="10" width="16" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] py-2.5 pl-10 pr-10 text-sm text-[#101828] outline-none transition focus:border-[#2554C7] focus:bg-white focus:ring-2 focus:ring-[#EEF4FF]"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="absolute right-3 flex items-center text-[#98A2B3] transition hover:text-[#2554C7]"
                >
                  {show ? (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.6 21.6 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.6 21.6 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                      <path d="M1 1l22 22" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </label>

            <div className="-mt-2 text-right">
              <Link to="/forgot-password" className="text-xs font-bold text-[#2554C7] hover:text-[#17368F] hover:underline">
                Forgot password?
              </Link>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-[#FEF3F2] px-3 py-2 text-xs font-medium text-[#D92D20]">
                <svg className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v5M12 16h.01" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#2554C7] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#17368F] disabled:opacity-60"
            >
              {busy ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  যাচাই হচ্ছে…
                </>
              ) : (
                "Login"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
