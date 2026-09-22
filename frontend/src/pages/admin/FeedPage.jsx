import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createPost,
  listFeed,
  listFeedAds,
} from "../../api/guest.js";
import { useRealtimeRefresh } from "../../realtime/realtimeHooks.js";
import AdComposer from "../../components/AdComposer.jsx";
import FeedList from "../../components/FeedList.jsx";

const BANNER_SLIDE_INTERVAL_MS = 3000;

function PencilIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 20h4l10-10-4-4L4 16v4Z" />
      <path d="M13.5 6.5 17.5 10.5" />
    </svg>
  );
}

function MegaphoneIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 11.5a3.5 3.5 0 0 0 3.5 3.5H8v-7H6.5A3.5 3.5 0 0 0 3 11.5Z" />
      <path d="M8 8.5 20 3v18L8 15.5" />
      <path d="M15 8v8" />
    </svg>
  );
}

function CloseIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

export default function FeedPage({ currentUser, onLoggedOut }) {
  const [posts, setPosts] = useState(null);
  const [ads, setAds] = useState([]);
  const [error, setError] = useState("");
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isAdComposerOpen, setIsAdComposerOpen] = useState(false);

  const isAdmin = currentUser.role === "admin";
  const canPost = isAdmin || Boolean(currentUser.can_post_feed);

  const load = useCallback(() => {
    setError("");

    Promise.allSettled([
      listFeed(),
      listFeedAds().catch((error) => {
        const status = error?.response?.status;
        if (status === 401) {
          onLoggedOut?.();
        }
        return null;
      }),
    ])
      .then(([feedResult, adsResult]) => {
        if (feedResult.status === "fulfilled") {
          setPosts(feedResult.value.data);
        } else {
          const status = feedResult.reason?.response?.status;
          if (status === 401) onLoggedOut?.();
          else setError("à¦«à¦¿à¦¡ à¦²à§‹à¦¡ à¦•à¦°à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤");
          setPosts([]);
        }

        if (adsResult?.status === "fulfilled") {
          setAds(Array.isArray(adsResult.value?.data) ? adsResult.value.data : []);
        } else {
          setAds([]);
        }
      });
  }, [onLoggedOut]);

  useEffect(load, [load]);
  useRealtimeRefresh(
    ["posts", "post_comments", "post_reactions", "poll_options", "poll_votes", "feed_ads"],
    load
  );

  // Banner ads are released separately from feed ads. Only placement === "banner" is shown in the carousel.
  const bannerAds = useMemo(() => ads.filter((ad) => ad.placement === "banner"), [ads]);
  const feedAds = useMemo(() => ads.filter((ad) => ad.placement !== "banner"), [ads]);

  if (error) return <div className="mx-auto max-w-2xl px-5 py-14 text-center text-sm text-[#D92D20]">{error}</div>;
  if (posts === null) return <div className="mx-auto max-w-2xl px-5 py-14 text-center text-sm text-[#667085]">à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡â€¦</div>;

  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-4">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        {canPost && (
          <button
            type="button"
            onClick={() => setIsComposerOpen(true)}
            className="group flex flex-1 items-center justify-between rounded-2xl border border-[#E4E7EC] bg-white px-4 py-3.5 text-left shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-all hover:-translate-y-0.5 hover:border-[#2554C7] hover:shadow-[0_8px_20px_-6px_rgba(37,84,199,0.25)]"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-[#101828]">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF4FF] text-[#2554C7] transition-transform group-hover:scale-105">
                <PencilIcon className="h-4 w-4" />
              </span>
              à¦¨à¦¤à§à¦¨ à¦ªà§‹à¦¸à§à¦Ÿ à¦²à¦¿à¦–à§à¦¨
            </span>
            <span className="rounded-full bg-[#EEF4FF] px-2.5 py-1 text-xs font-bold text-[#2554C7]">+ à¦¨à¦¤à§à¦¨</span>
          </button>
        )}

        {isAdmin && (
          <button
            type="button"
            onClick={() => setIsAdComposerOpen(true)}
            className="group flex flex-1 items-center justify-between rounded-2xl border border-[#E4E7EC] bg-white px-4 py-3.5 text-left shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-all hover:-translate-y-0.5 hover:border-amber-500 hover:shadow-[0_8px_20px_-6px_rgba(217,119,6,0.25)]"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-[#101828]">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-amber-600 transition-transform group-hover:scale-105">
                <MegaphoneIcon className="h-4 w-4" />
              </span>
              à¦¨à¦¤à§à¦¨ à¦¬à¦¿à¦œà§à¦žà¦¾à¦ªà¦¨
            </span>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">+ à¦¨à¦¤à§à¦¨</span>
          </button>
        )}
      </div>

      {bannerAds.length > 0 && (
        <div className="mb-5">
          <AdsBannerCarousel ads={bannerAds} />
        </div>
      )}

      {isComposerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-3 py-6 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-[#E4E7EC] bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-[#101828]">à¦¨à¦¤à§à¦¨ à¦ªà§‹à¦¸à§à¦Ÿ</h2>
                <p className="text-xs text-[#667085]">à¦†à¦ªà¦¨à¦¾à¦° à¦†à¦ªà¦¡à§‡à¦Ÿ à¦¶à§‡à¦¯à¦¼à¦¾à¦° à¦•à¦°à§à¦¨</p>
              </div>
              <button
                type="button"
                onClick={() => setIsComposerOpen(false)}
                className="rounded-lg p-2 text-[#667085] hover:bg-[#F9FAFB]"
                aria-label="à¦¬à¦¨à§à¦§ à¦•à¦°à§à¦¨"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <PostComposer onPosted={load} onClose={() => setIsComposerOpen(false)} />
          </div>
        </div>
      )}

      {isAdComposerOpen && (
        <AdComposer
          onCreated={load}
          onClose={() => setIsAdComposerOpen(false)}
        />
      )}

      {posts.length === 0 && feedAds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E4E7EC] bg-white py-14 text-center text-sm text-[#98A2B3]">
          à¦à¦–à¦¨à§‹ à¦•à§‹à¦¨à§‹ à¦ªà§‹à¦¸à§à¦Ÿ à¦¬à¦¾ à¦¬à¦¿à¦œà§à¦žà¦¾à¦ªà¦¨ à¦¨à§‡à¦‡à¥¤
        </div>
      ) : (
        <FeedList posts={posts} ads={feedAds} currentUser={currentUser} onPostChanged={load} onAdDeleted={load} />
      )}
    </div>
  );
}

/**
 * à¦à¦•à¦¾à¦§à¦¿à¦• banner ad à¦¨à¦¿à¦¯à¦¼à§‡ auto-sliding carouselà¥¤
 * à¦ªà§à¦°à¦¤à¦¿à¦Ÿà¦¾ ad object-à¦ à¦¨à¦¿à¦šà§‡à¦° à¦¯à§‡à¦•à§‹à¦¨à§‹ matching à¦«à¦¿à¦²à§à¦¡ à¦¥à¦¾à¦•à¦²à§‡à¦‡ à¦•à¦¾à¦œ à¦•à¦°à¦¬à§‡:
 *  - à¦›à¦¬à¦¿:      banner_image_url / ad_image_url / image_url
 *  - à¦²à¦¿à¦‚à¦•:      website_url / ad_website_url / link_url
 *  - à¦¶à¦¿à¦°à§‹à¦¨à¦¾à¦®:   title
 */
function AdsBannerCarousel({ ads }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);

  const slides = useMemo(
    () =>
      ads.map((ad) => ({
        id: ad.id,
        title: ad.title || "",
        imageUrl: ad.banner_image_url || ad.ad_image_url || ad.image_url || "",
        websiteUrl: ad.website_url || ad.ad_website_url || ad.link_url || "",
      })),
    [ads]
  );

  useEffect(() => {
    if (activeIndex >= slides.length) setActiveIndex(0);
  }, [slides.length, activeIndex]);

  useEffect(() => {
    if (slides.length <= 1 || isPaused) return undefined;
    timerRef.current = setInterval(() => {
      setActiveIndex((i) => (i + 1) % slides.length);
    }, BANNER_SLIDE_INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, [slides.length, isPaused]);

  if (slides.length === 0) return null;

  function goTo(index) {
    setActiveIndex((index + slides.length) % slides.length);
  }

  function resolveUrl(url) {
    if (!url) return null;
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-[#E4E7EC] bg-[#0B1220] shadow-[0_10px_30px_-12px_rgba(16,24,40,0.25)]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="absolute left-3 top-3 z-10 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white backdrop-blur-sm">
        à¦¸à§à¦ªà¦¨à¦¸à¦°à¦¡
      </div>

      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
      >
        {slides.map((slide) => {
          const href = resolveUrl(slide.websiteUrl);
          const Wrapper = href ? "a" : "div";
          return (
            <Wrapper
              key={slide.id}
              {...(href ? { href, target: "_blank", rel: "noreferrer" } : {})}
              className="relative block w-full flex-shrink-0"
            >
              <div className="aspect-[16/6] w-full bg-[#111827] sm:aspect-[16/5]">
                {slide.imageUrl && (
                  <img
                    src={slide.imageUrl}
                    alt={slide.title || "à¦¬à¦¿à¦œà§à¦žà¦¾à¦ªà¦¨"}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                )}
              </div>
              {slide.title && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-4 py-3">
                  <div className="text-sm font-bold text-white sm:text-base">{slide.title}</div>
                </div>
              )}
            </Wrapper>
          );
        })}
      </div>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(activeIndex - 1)}
            className="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60"
            aria-label="à¦†à¦—à§‡à¦° à¦¬à¦¿à¦œà§à¦žà¦¾à¦ªà¦¨"
          >
            â€¹
          </button>
          <button
            type="button"
            onClick={() => goTo(activeIndex + 1)}
            className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60"
            aria-label="à¦ªà¦°à§‡à¦° à¦¬à¦¿à¦œà§à¦žà¦¾à¦ªà¦¨"
          >
            â€º
          </button>

          <div className="absolute inset-x-0 bottom-2 z-10 flex items-center justify-center gap-1.5">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`à¦¸à§à¦²à¦¾à¦‡à¦¡ ${index + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  index === activeIndex ? "w-5 bg-white" : "w-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PostComposer({ onPosted, onClose }) {
  const [content, setContent] = useState("");
  const [postType, setPostType] = useState("text");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [mediaType, setMediaType] = useState("website");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    const trimmedContent = content.trim();
    const trimmedTitle = linkTitle.trim();
    const trimmedLinkUrl = linkUrl.trim();
    const trimmedPollOptions = pollOptions.map((item) => item.trim()).filter(Boolean);

    if (postType === "link") {
      if (!trimmedTitle && !trimmedContent) {
        setErr("à¦²à¦¿à¦‚à¦• à¦ªà§‹à¦¸à§à¦Ÿà§‡à¦° à¦œà¦¨à§à¦¯ title à¦¬à¦¾ description à¦¦à¦¿à¦¨");
        return;
      }
      if (!trimmedLinkUrl) {
        setErr("à¦²à¦¿à¦‚à¦• URL à¦¦à¦¿à¦¨");
        return;
      }
    } else if (postType === "poll") {
      if (!trimmedContent) {
        setErr("à¦ªà§‹à¦²à§‡à¦° à¦œà¦¨à§à¦¯ à¦•à¦¿à¦›à§ à¦²à§‡à¦–à¦¾ à¦¦à¦¿à¦¨");
        return;
      }
      if (trimmedPollOptions.length < 2) {
        setErr("Poll-à¦ à¦•à¦®à¦ªà¦•à§à¦·à§‡ à¦¦à§à¦Ÿà¦¿ option à¦¦à¦¿à¦¨");
        return;
      }
    } else if (!trimmedContent) {
      setErr("à¦ªà§‹à¦¸à§à¦Ÿà§‡à¦° à¦²à§‡à¦–à¦¾ à¦–à¦¾à¦²à¦¿ à¦°à¦¾à¦–à¦¾ à¦¯à¦¾à¦¬à§‡ à¦¨à¦¾");
      return;
    }

    setBusy(true);
    setErr("");
    try {
      await createPost({
        content: trimmedContent || trimmedTitle,
        title: postType === "link" ? trimmedTitle : null,
        description: postType === "link" ? trimmedContent : null,
        post_type: postType,
        link_url: postType === "link" ? trimmedLinkUrl : null,
        media_type: postType === "link" ? mediaType : null,
        poll_options: postType === "poll" ? trimmedPollOptions : null,
      });
      setContent("");
      setLinkTitle("");
      setLinkUrl("");
      setMediaType("website");
      setPollOptions(["", ""]);
      onPosted();
      onClose?.();
    } catch (err) {
      console.error(err);
      setErr("à¦ªà§‹à¦¸à§à¦Ÿ à¦•à¦°à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-[#E4E7EC] bg-white p-4">
      <div className="mb-3 flex gap-2">
        {[["text", "à¦²à§‡à¦–à¦¾"], ["link", "à¦²à¦¿à¦‚à¦•"], ["poll", "à¦ªà§‹à¦²"]].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setPostType(value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${postType === value ? "bg-[#EEF4FF] text-[#2554C7]" : "bg-[#F9FAFB] text-[#667085]"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {postType === "link" ? (
        <div className="space-y-2">
          <input
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            placeholder="Title (à¦à¦šà§à¦›à¦¿à¦•)"
            className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm outline-none focus:border-[#2554C7]"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Description / caption à¦²à¦¿à¦–à§à¦¨..."
            rows={3}
            className="w-full resize-none rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm outline-none focus:border-[#2554C7]"
          />
          <div className="flex flex-wrap gap-2">
            {["website", "image", "audio", "video"].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMediaType(value)}
                className={`rounded-full px-3 py-1 text-[11px] font-bold ${mediaType === value ? "bg-[#2554C7] text-white" : "bg-[#F9FAFB] text-[#667085]"}`}
              >
                {value === "website" ? "Website" : value === "image" ? "Image" : value === "audio" ? "Audio" : "Video"}
              </button>
            ))}
          </div>
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com à¦¬à¦¾ image/audio/video URL"
            className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm outline-none focus:border-[#2554C7]"
          />
        </div>
      ) : (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="à¦¨à¦¤à§à¦¨ à¦ªà§‹à¦¸à§à¦Ÿ à¦²à¦¿à¦–à§à¦¨..."
          rows={3}
          className="w-full resize-none rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm outline-none focus:border-[#2554C7]"
        />
      )}
      {postType === "poll" && (
        <div className="mt-2 space-y-2">
          {pollOptions.map((option, index) => (
            <input
              key={index}
              value={option}
              onChange={(e) => setPollOptions((items) => items.map((item, itemIndex) => itemIndex === index ? e.target.value : item))}
              placeholder={`Option ${index + 1}`}
              className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm outline-none focus:border-[#2554C7]"
            />
          ))}
          {pollOptions.length < 6 && (
            <button type="button" onClick={() => setPollOptions((items) => [...items, ""])} className="text-xs font-bold text-[#2554C7]">
              + Option à¦¯à§‹à¦— à¦•à¦°à§à¦¨
            </button>
          )}
        </div>
      )}
      {err && <div className="mt-1 text-xs text-[#D92D20]">{err}</div>}
      <div className="mt-2 flex justify-end">
        <button
          onClick={submit}
          disabled={busy || (postType === "link" ? (!content.trim() && !linkTitle.trim()) || !linkUrl.trim() : !content.trim()) || (postType === "poll" && pollOptions.filter((item) => item.trim()).length < 2)}
          className="rounded-lg bg-[#2554C7] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          {busy ? "à¦ªà§‹à¦¸à§à¦Ÿ à¦¹à¦šà§à¦›à§‡â€¦" : "à¦ªà§‹à¦¸à§à¦Ÿ à¦•à¦°à§à¦¨"}
        </button>
      </div>
    </div>
  );
}