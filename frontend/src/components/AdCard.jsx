import { useState } from "react";
import { deleteFeedAd } from "../api/guest.js";
import ProfileAvatar from "./ProfileAvatar.jsx";

export default function AdCard({ ad, currentUser, onDeleted }) {
  const isAdmin = currentUser.role === "admin";
  const [deleting, setDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  function handleDelete() {
    if (!window.confirm("এই বিজ্ঞাপনটি ডিলিট করবেন?")) return;
    setDeleting(true);
    deleteFeedAd(ad.id)
      .then(() => onDeleted?.())
      .catch(() => {})
      .finally(() => setDeleting(false));
  }

  const resolvedImage = ad.image_url
    ? /^https?:\/\//i.test(ad.image_url)
      ? ad.image_url
      : `https://${ad.image_url}`
    : null;

  const resolvedWebsite = /^https?:\/\//i.test(ad.website_url)
    ? ad.website_url
    : `https://${ad.website_url}`;

  const websiteDomain = (() => {
    try {
      return new URL(resolvedWebsite).hostname;
    } catch {
      return ad.website_url;
    }
  })();

  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <ProfileAvatar name={ad.sponsor_name || ad.title} className="h-7 w-7" fallbackClassName="bg-[#2554C7]" />
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#101828]">
              {ad.sponsor_name}
              <span className="rounded-full bg-[#EEF4FF] px-1.5 py-0.5 text-[8px] font-black uppercase text-[#2554C7]">
                স্পনসরড
              </span>
            </div>
            {websiteDomain && <div className="text-[10px] text-[#667085]">{websiteDomain}</div>}
          </div>
        </div>

        {isAdmin && (
          <div className="relative flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-full border border-[#D0D5DD] bg-[#F9FAFB] p-1.5 text-[#344054] shadow-sm transition hover:bg-[#EEF4FF] hover:text-[#2554C7]"
              aria-label="Open ad actions"
            >
              <MoreIcon className="h-3.5 w-3.5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-9 z-10 min-w-[160px] rounded-xl border border-[#E4E7EC] bg-white p-1.5 shadow-lg">
                <button type="button" onClick={() => setMenuOpen(false)} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB]">
                  <EditIcon /> Edit
                </button>
                <button type="button" onClick={() => setMenuOpen(false)} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB]">
                  <HideIcon /> Hide
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs font-semibold text-[#D92D20] hover:bg-[#FEF3F2] disabled:opacity-50"
                >
                  <DeleteIcon /> {deleting ? "ডিলিট হচ্ছে…" : "ডিলিট করুন"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {(ad.title || ad.description) && (
        <div className="mt-2">
          {ad.title && <div className="text-[13px] font-black text-[#101828]">{ad.title}</div>}
          {ad.description && (
            <div className="mt-0.5 whitespace-pre-wrap text-[12.5px] leading-5 text-[#344054]">{ad.description}</div>
          )}
        </div>
      )}

      {resolvedImage && (
        <div className="mt-2 overflow-hidden rounded-lg border border-[#E4E7EC] bg-white">
          <a href={resolvedWebsite} target="_blank" rel="noreferrer sponsored" className="block">
            <img
              src={resolvedImage}
              alt={ad.title}
              className="max-h-44 w-full object-cover"
              loading="lazy"
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          </a>
          <a
            href={resolvedWebsite}
            target="_blank"
            rel="noreferrer sponsored"
            className="flex items-center justify-between border-t border-[#E4E7EC] bg-[#F9FAFB] px-2.5 py-1.5 text-[11px] font-semibold text-[#2554C7]"
          >
            <span>{websiteDomain}</span>
            <span>{ad.cta_text || "ভিজিট করুন"}</span>
          </a>
        </div>
      )}
    </div>
  );
}

function MoreIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="6" cy="12" r="1.5" />
      <circle cx="18" cy="12" r="1.5" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  );
}

function HideIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a2 2 0 1 0 2.8 2.8" />
      <path d="M9.9 5.1A10.9 10.9 0 0 1 12 5c4.1 0 7.7 2.3 9.5 5.7a11.5 11.5 0 0 1-4 4.8" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M8 7l1 12h6l1-12" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}