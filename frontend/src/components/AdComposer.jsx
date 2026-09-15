import { useState } from "react";
import { createFeedAd } from "../api/guest.js";

export default function AdComposer({ onCreated, onClose }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [adType, setAdType] = useState("feed");
  const [placement, setPlacement] = useState("first");
  const [afterPosts, setAfterPosts] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setErr("");

    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();
    const trimmedImage = imageUrl.trim();
    const trimmedWebsite = websiteUrl.trim();
    const trimmedCta = ctaText.trim();

    if (!trimmedTitle) { setErr("Title দিন"); return; }
    if (!trimmedImage) { setErr("Image URL দিন"); return; }
    if (!trimmedWebsite) { setErr("Website URL দিন"); return; }
    if (!trimmedCta) { setErr("CTA button text দিন"); return; }
    if (adType === "feed" && placement === "after" && (!afterPosts || parseInt(afterPosts, 10) < 1)) {
      setErr("after_posts minimum ১ হতে হবে");
      return;
    }

    setBusy(true);
    try {
      await createFeedAd({
        title: trimmedTitle,
        description: trimmedDesc || `${trimmedTitle} advertisement`,
        image_url: trimmedImage,
        website_url: trimmedWebsite,
        cta_text: trimmedCta || "বিস্তারিত দেখুন",
        sponsor_name: "Quantum Foundation",
        placement: adType === "banner" ? "banner" : placement,
        after_posts: adType === "feed" && placement === "after" ? parseInt(afterPosts, 10) : null,
        is_active: isActive,
      });
      setTitle("");
      setDescription("");
      setImageUrl("");
      setWebsiteUrl("");
      setCtaText("");
      setPlacement("first");
      setAfterPosts("");
      setIsActive(true);
      onCreated?.();
      onClose?.();
    } catch (e) {
      const msg = e.response?.data?.detail || "বিজ্ঞাপন তৈরি করা যায়নি।";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-3 py-6">
      <div className="w-full max-w-xl rounded-2xl border border-[#E4E7EC] bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-[#101828]">নতুন বিজ্ঞাপন</h2>
            <p className="text-xs text-[#667085]">Feed-এ বিজ্ঞাপন যোগ করুন</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm font-semibold text-[#667085] hover:bg-[#F9FAFB]"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#344054]">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="বিজ্ঞাপনের শিরোনাম"
              className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm outline-none focus:border-[#2554C7]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#344054]">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="বিজ্ঞাপনের বিবরণ"
              rows={2}
              className="w-full resize-none rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm outline-none focus:border-[#2554C7]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#344054]">Image URL *</label>
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm outline-none focus:border-[#2554C7]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#344054]">Website URL *</label>
              <input
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm outline-none focus:border-[#2554C7]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#344054]">CTA Button Text *</label>
            <input
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
              placeholder="বিস্তারিত দেখুন"
              className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm outline-none focus:border-[#2554C7]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#344054]">Ad Type</label>
              <select
                value={adType}
                onChange={(e) => {
                  const type = e.target.value;
                  setAdType(type);
                  if (type === "banner") {
                    setPlacement("banner");
                    setAfterPosts("");
                  } else if (placement === "banner") {
                    setPlacement("first");
                  }
                }}
                className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm outline-none focus:border-[#2554C7]"
              >
                <option value="feed">Feed Ad</option>
                <option value="banner">Banner Ad</option>
              </select>
            </div>
            {adType === "feed" && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#344054]">Placement</label>
                <select
                  value={placement}
                  onChange={(e) => setPlacement(e.target.value)}
                  className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm outline-none focus:border-[#2554C7]"
                >
                  <option value="first">প্রথমে</option>
                  <option value="after">নির্দিষ্ট পোস্টের পরে</option>
                </select>
              </div>
            )}
            {adType === "feed" && placement === "after" && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#344054]">After Posts *</label>
                <input
                  type="number"
                  min="1"
                  value={afterPosts}
                  onChange={(e) => setAfterPosts(e.target.value)}
                  placeholder="৩"
                  className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm outline-none focus:border-[#2554C7]"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              id="ad-active"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-[#E4E7EC] text-[#2554C7] focus:ring-[#2554C7]"
            />
            <label htmlFor="ad-active" className="text-xs font-semibold text-[#344054]">Active</label>
          </div>

          {err && <div className="text-xs text-[#D92D20]">{err}</div>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-[#667085]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="rounded-lg bg-[#2554C7] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ করুন"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}