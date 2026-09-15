import { useState } from "react";
import {
  savePost,
  hidePost,
  deletePost,
  updatePost,
  listPostComments,
  addPostComment,
  votePoll,
  reactToPost,
} from "../api/guest.js";
import ProfileAvatar from "./ProfileAvatar.jsx";
import { renderLinkPreview } from "./LinkPreview.jsx";

export default function PostCard({ post, currentUser, onChanged }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [editTitle, setEditTitle] = useState(post.link_title || "");
  const [editContent, setEditContent] = useState(post.content || "");
  const [editLinkUrl, setEditLinkUrl] = useState(post.link_url || "");
  const [busyAction, setBusyAction] = useState(false);
  const isAdmin = currentUser.role === "admin";
  const canManage = isAdmin || post.author_id === currentUser.id;

  const MAX_DESCRIPTION_LENGTH = 240;
  const descriptionText = post.content ? String(post.content).trim() : "";
  const isDescriptionLong = descriptionText.length > MAX_DESCRIPTION_LENGTH;
  const visibleDescription = isDescriptionLong && !showFullDescription
    ? `${descriptionText.slice(0, MAX_DESCRIPTION_LENGTH).trim()}…`
    : descriptionText;

  function toggleDescription() {
    setShowFullDescription((v) => !v);
  }

  function loadComments() {
    listPostComments(post.id).then((res) => setComments(res.data));
  }

  function toggleComments() {
    setShowComments((v) => !v);
    if (!comments) loadComments();
  }

  async function submitComment() {
    if (!commentText.trim()) return;
    await addPostComment(post.id, commentText.trim());
    setCommentText("");
    loadComments();
    onChanged();
  }

  async function handleDelete() {
    if (!window.confirm("এই পোস্টটি ডিলিট করবেন?")) return;
    setBusyAction(true);
    try {
      await deletePost(post.id);
      onChanged();
    } finally {
      setBusyAction(false);
      setMenuOpen(false);
    }
  }

  async function handleSave() {
    setBusyAction(true);
    try {
      await savePost(post.id);
      onChanged();
    } finally {
      setBusyAction(false);
      setMenuOpen(false);
    }
  }

  async function handleHide() {
    setBusyAction(true);
    try {
      await hidePost(post.id);
      onChanged();
    } finally {
      setBusyAction(false);
      setMenuOpen(false);
    }
  }

  async function handleEditSave() {
    setBusyAction(true);
    try {
      await updatePost(post.id, {
        title: editTitle.trim() || null,
        content: editContent.trim(),
        link_url: editLinkUrl.trim() || null,
      });
      setIsEditing(false);
      onChanged();
    } finally {
      setBusyAction(false);
      setMenuOpen(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#E4E7EC] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ProfileAvatar name={post.author_name} className="h-9 w-9" fallbackClassName="bg-[#2554C7]" />
          <div>
            <div className="flex items-center gap-1.5 text-sm font-bold text-[#101828]">
              {post.author_name}
              {post.author_role === "admin" && (
                <span className="rounded-full bg-[#EEF4FF] px-2 py-0.5 text-[9px] font-black uppercase text-[#2554C7]">Admin</span>
              )}
              {post.is_pinned && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase text-amber-700">পিন করা</span>
              )}
            </div>
            <div className="text-[11px] text-[#667085]">{formatFeedTime(post.created_at)}</div>
          </div>
        </div>

        {canManage && (
          <div className="relative flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-full border border-[#D0D5DD] bg-[#F9FAFB] p-2.5 text-[#344054] shadow-sm transition hover:bg-[#EEF4FF] hover:text-[#2554C7]"
              aria-label="Open feed actions"
            >
              <MoreIcon className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-11 z-10 min-w-[172px] rounded-xl border border-[#E4E7EC] bg-white p-1.5 shadow-lg">
                <button type="button" onClick={() => { setIsEditing(true); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#344054] hover:bg-[#F9FAFB]">
                  <EditIcon /> Edit
                </button>
                <button type="button" onClick={handleHide} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#344054] hover:bg-[#F9FAFB]">
                  <HideIcon /> Hide
                </button>
                <button type="button" onClick={handleSave} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#344054] hover:bg-[#F9FAFB]">
                  <SaveIcon /> {post.is_saved ? "Saved" : "Save"}
                </button>
                <button type="button" onClick={handleDelete} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#D92D20] hover:bg-[#FEF3F2]">
                  <DeleteIcon /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {post.post_type !== "poll" && ((post.post_type === "link" && post.link_url) || post.link_title || descriptionText) && (
        <div className="mt-3 rounded-none bg-transparent p-0">
          {post.post_type === "link" && post.link_title && <div className="font-black text-[#101828]">{post.link_title}</div>}
          {descriptionText && (
            <div className="mt-1 text-[15px] leading-6 text-[#344054]">
              <div className="whitespace-pre-wrap">{visibleDescription}</div>
              {isDescriptionLong && (
                <button
                  type="button"
                  onClick={toggleDescription}
                  className="mt-3 text-sm font-semibold text-[#2554C7] hover:text-[#1d4bbc]"
                >
                  {showFullDescription ? "কম দেখুন" : "আরও দেখুন"}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {post.post_type === "link" && post.link_url && (
        <div className="mt-3 overflow-hidden rounded-none border border-[#E4E7EC] bg-white">
          {renderLinkPreview(post.link_url, post.link_title)}
          <a
            href={post.link_url}
            target="_blank"
            rel="noreferrer"
            className="block border-t border-[#E4E7EC] bg-[#F9FAFB] px-3 py-2 text-xs font-semibold text-[#2554C7]"
          >
            {post.link_domain || post.link_url}
          </a>
        </div>
      )}

      {post.post_type === "poll" && post.poll_options && (
        <PollBlock post={post} onChanged={onChanged} />
      )}

      <div className="mt-3 flex items-center gap-4 border-t border-[#F1F2F4] pt-3 text-xs text-[#667085]">
        <button
          onClick={() => reactToPost(post.id).then(onChanged)}
          className="flex items-center gap-1 font-semibold hover:text-[#2554C7]"
        >
          <ThumbUpIcon className="h-4 w-4" />
          {post.reaction_count}
        </button>
        <button onClick={toggleComments} className="flex items-center gap-1 font-semibold hover:text-[#2554C7]">
          <CommentIcon className="h-4 w-4" />
          {post.comment_count}
        </button>
      </div>

      {isEditing && (
        <div className="mt-3 rounded-none border border-[#E4E7EC] bg-[#F9FAFB] p-3">
          <div className="mb-2 text-sm font-black text-[#101828]">Edit post</div>
          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Title" className="mb-2 w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm" />
          <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={3} placeholder="Description" className="mb-2 w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm" />
          <input value={editLinkUrl} onChange={(e) => setEditLinkUrl(e.target.value)} placeholder="Link URL" className="mb-2 w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsEditing(false)} className="rounded-lg px-3 py-2 text-sm font-semibold text-[#667085]">Cancel</button>
            <button type="button" onClick={handleEditSave} disabled={busyAction} className="rounded-lg bg-[#2554C7] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Save</button>
          </div>
        </div>
      )}

      {showComments && (
        <div className="mt-3 space-y-2 border-t border-[#F1F2F4] pt-3">
          {(comments || []).map((c) => (
            <div key={c.id} className="rounded-lg bg-[#F9FAFB] px-3 py-2 text-xs">
              <span className="font-bold text-[#101828]">{c.author_name}: </span>
              <span className="text-[#344054]">{c.content}</span>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitComment()}
              placeholder="কমেন্ট লিখুন..."
              className="flex-1 rounded-lg border border-[#E4E7EC] px-3 py-1.5 text-xs outline-none focus:border-[#2554C7]"
            />
            <button
              onClick={submitComment}
              className="rounded-lg bg-[#2554C7] px-3 py-1.5 text-xs font-bold text-white"
            >
              পাঠান
            </button>
          </div>
        </div>
      )}
    </div>
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

function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M9 4v4h6V4" />
      <path d="M8 13h8" />
      <path d="M8 17h5" />
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

function MoreIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="6" cy="12" r="1.5" />
      <circle cx="18" cy="12" r="1.5" />
    </svg>
  );
}

function ThumbUpIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 9V5a3 3 0 0 0-6 0v4" />
      <path d="M5 15H3a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1h2" />
      <path d="M5 15v6a1 1 0 0 0 1 1h4l5-8V9a2 2 0 0 0-2-2h-3" />
      <path d="M22 12h-4" />
    </svg>
  );
}

function CommentIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v10Z" />
      <path d="M17 10h-6" />
      <path d="M17 14h-3" />
    </svg>
  );
}

function PollBlock({ post, onChanged }) {
  const total = post.poll_options.reduce((sum, o) => sum + o.vote_count, 0);
  return (
    <div className="mt-3 space-y-2">
      {post.poll_options.map((opt) => {
        const pct = total ? Math.round((opt.vote_count / total) * 100) : 0;
        return (
          <button
            key={opt.id}
            onClick={() => votePoll(opt.id).then(onChanged)}
            className="relative w-full overflow-hidden rounded-lg border border-[#E4E7EC] px-3 py-2 text-left text-xs"
          >
            <div className="absolute inset-y-0 left-0 bg-[#EEF4FF]" style={{ width: `${pct}%` }} />
            <div className="relative flex justify-between font-semibold text-[#344054]">
              <span>{opt.label}</span>
              <span>{pct}%</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function formatFeedTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 1) {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  if (diffDays === 1) return "Yesterday";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}