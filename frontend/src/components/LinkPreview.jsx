function safeParseUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function extractYouTubeId(url) {
  const parsed = safeParseUrl(url);
  if (!parsed) return null;
  const host = parsed.hostname.replace(/^www\./, "");
  if (host === "youtube.com" || host === "m.youtube.com") {
    const videoId = parsed.searchParams.get("v");
    if (videoId) return videoId;
  }
  if (host === "youtu.be") {
    const path = parsed.pathname.replace(/^\//, "").split("/")[0];
    return path || null;
  }
  return null;
}

function extractVimeoId(url) {
  const parsed = safeParseUrl(url);
  if (!parsed) return null;
  const match = parsed.pathname.match(/\/([0-9]+)(?:\/|$)/);
  return match ? match[1] : null;
}

function extractDriveFileId(url) {
  const parsed = safeParseUrl(url);
  if (!parsed) return null;
  if (parsed.pathname.includes("/file/d/")) {
    const match = parsed.pathname.match(/\/file\/d\/([^/]+)/);
    return match ? match[1] : null;
  }
  return parsed.searchParams.get("id");
}

export function renderLinkPreview(url, fallbackTitle) {
  const resolvedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const lower = resolvedUrl.toLowerCase();
  const parsed = safeParseUrl(resolvedUrl);
  const pathname = parsed?.pathname || "";
  const isImage = /\.(png|jpe?g|gif|webp|svg)([?#].*)?$/i.test(pathname);
  const isAudio = /\.(mp3|wav|ogg|m4a|aac|m4b)([?#].*)?$/i.test(pathname);
  const isVideo = /\.(mp4|webm|ogg|mov|m3u8)([?#].*)?$/i.test(pathname);
  const isYouTube = lower.includes("youtube.com") || lower.includes("youtu.be");
  const isVimeo = lower.includes("vimeo.com");
  const isDrive = lower.includes("drive.google.com");
  const isFacebook = lower.includes("facebook.com") || lower.includes("fb.com") || lower.includes("fb.watch");
  const isInstagram = lower.includes("instagram.com");
  const isFacebookVideo = isFacebook && (
    pathname.includes("/videos/") ||
    pathname.includes("/watch") ||
    pathname.includes("/share/v/") ||
    lower.includes("fb.watch")
  );

  if (isImage) {
    return <img src={resolvedUrl} alt={fallbackTitle || "Shared image"} className="max-h-96 w-full object-contain" loading="lazy" />;
  }
  if (isAudio) {
    return <audio controls className="w-full" src={resolvedUrl} preload="metadata" />;
  }
  if (isYouTube) {
    const videoId = extractYouTubeId(resolvedUrl);
    if (videoId) {
      return (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}`}
          title={fallbackTitle || "Shared video"}
          className="aspect-video w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }
  }
  if (isFacebookVideo) {
    const embedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(resolvedUrl)}&show_text=true&width=500`;
    return (
      <iframe
        src={embedUrl}
        title={fallbackTitle || "Shared Facebook video"}
        className="aspect-video w-full min-h-[420px] border-0"
        scrolling="no"
        allow="autoplay; fullscreen"
        allowFullScreen
      />
    );
  }
  if (isVideo) {
    return <video controls playsInline preload="metadata" className="max-h-96 w-full bg-black" src={resolvedUrl} />;
  }
  if (isVimeo) {
    const videoId = extractVimeoId(resolvedUrl);
    if (videoId) {
      return (
        <iframe
          src={`https://player.vimeo.com/video/${videoId}`}
          title={fallbackTitle || "Shared video"}
          className="aspect-video w-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      );
    }
  }
  if (isDrive) {
    const fileId = extractDriveFileId(resolvedUrl);
    if (fileId) {
      return (
        <iframe
          src={`https://drive.google.com/file/d/${fileId}/preview`}
          title={fallbackTitle || "Shared video"}
          className="aspect-video w-full"
          allowFullScreen
        />
      );
    }
  }
  if (isFacebookVideo) {
    const embedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(resolvedUrl)}&show_text=true&width=500`;
    return (
      <iframe
        src={embedUrl}
        title={fallbackTitle || "Shared Facebook video"}
        className="aspect-video w-full min-h-[420px] border-0"
        scrolling="no"
        allow="autoplay; fullscreen"
        allowFullScreen
      />
    );
  }
  if (isFacebook) {
    return (
      <iframe
        src={`https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(resolvedUrl)}&show_text=true&width=500`}
        title={fallbackTitle || "Shared Facebook post"}
        className="w-full min-h-[420px] border-0"
        scrolling="no"
        allowFullScreen
      />
    );
  }
  if (isInstagram) {
    const instagramPath = parsed?.pathname.replace(/\/$/, "");
    const pathParts = instagramPath.split("/").filter(Boolean);
    const slug = pathParts[1] && ["p", "reel", "tv"].includes(pathParts[0]) ? pathParts[1] : null;
    const embedUrl = slug ? `https://www.instagram.com/p/${slug}/embed` : `https://www.instagram.com/embed/`;
    return (
      <iframe
        src={embedUrl}
        title={fallbackTitle || "Shared Instagram post"}
        className="w-full min-h-[500px] border-0"
        scrolling="no"
        allowFullScreen
      />
    );
  }

  return (
    <div className="p-3 text-xs text-[#344054]">
      <div className="font-bold text-[#101828]">{fallbackTitle || resolvedUrl}</div>
      <div className="mt-1 text-[#667085]">{resolvedUrl}</div>
    </div>
  );
}