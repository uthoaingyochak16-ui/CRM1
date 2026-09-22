import { sanitizeInstructionHtml } from "./instructionHtml.js";

export default function InstructionBox({ html, className = "", compact = false }) {
  const safeHtml = sanitizeInstructionHtml(html);
  if (!safeHtml || !safeHtml.replace(/<[^>]*>/g, "").trim()) return null;

  return (
    <aside className={`overflow-hidden rounded-xl border border-[#B2CCFF] bg-[#F5F8FF] text-left shadow-sm ${className}`}>
      <div className={`flex items-center border-b border-[#D6E4FF] bg-[#EAF1FF] ${compact ? "gap-1.5 px-2.5 py-1.5" : "gap-2 px-3 py-2"}`}>
        <span className={`flex items-center justify-center rounded-full bg-[#2554C7] font-black text-white ${compact ? "h-4 w-4 text-[9px]" : "h-5 w-5 text-[11px]"}`}>i</span>
        <span className={`font-black uppercase tracking-wide text-[#17368F] ${compact ? "text-[10px]" : "text-[11px]"}`}>Registration Instructions</span>
      </div>
      <div
        className={`instruction-content overflow-y-auto text-[#344054] [scrollbar-color:#B2CCFF_transparent] [&_ol]:list-decimal [&_ul]:list-disc ${compact ? "max-h-32 px-3 py-2 text-[10.5px] leading-4 [&_div+div]:mt-1 [&_li]:mb-0.5 [&_ol]:ml-4 [&_p+p]:mt-1 [&_ul]:ml-4" : "max-h-32 px-3.5 py-3 text-xs leading-5 [&_div+div]:mt-1.5 [&_li]:mb-1 [&_ol]:ml-5 [&_p+p]:mt-1.5 [&_ul]:ml-5"}`}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    </aside>
  );
}
