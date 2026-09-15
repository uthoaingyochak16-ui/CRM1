import { useEffect, useRef } from "react";
import DOMPurify from "dompurify";

const SANITIZE_OPTIONS = {
  ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "span", "br", "p", "div", "ul", "ol", "li", "font"],
  ALLOWED_ATTR: ["style", "color", "size"],
};

export function sanitizeInstructionHtml(html) {
  return DOMPurify.sanitize(html || "", SANITIZE_OPTIONS);
}

export default function RichInstructionEditor({ value, onChange, placeholder }) {
  const editorRef = useRef(null);

  useEffect(() => {
    const editor = editorRef.current;
    const safeValue = sanitizeInstructionHtml(value);
    if (editor && document.activeElement !== editor && editor.innerHTML !== safeValue) {
      editor.innerHTML = safeValue;
    }
  }, [value]);

  function run(command, commandValue = null) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(sanitizeInstructionHtml(editorRef.current?.innerHTML));
  }

  function keepSelection(event) {
    event.preventDefault();
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#D0D5DD] bg-white focus-within:border-[#2554C7] focus-within:ring-2 focus-within:ring-[#EEF4FF]">
      <div className="flex flex-wrap items-center gap-1 border-b border-[#E4E7EC] bg-[#F8FAFC] p-1.5">
        <Tool label="B" title="Bold" onMouseDown={keepSelection} onClick={() => run("bold")} className="font-black" />
        <Tool label="I" title="Italic" onMouseDown={keepSelection} onClick={() => run("italic")} className="italic" />
        <Tool label="U" title="Underline" onMouseDown={keepSelection} onClick={() => run("underline")} className="underline" />
        <Divider />
        <select
          defaultValue=""
          aria-label="Text size"
          onChange={(event) => {
            if (event.target.value) run("fontSize", event.target.value);
            event.target.value = "";
          }}
          className="h-8 rounded-md border border-[#D0D5DD] bg-white px-2 text-xs font-semibold text-[#475467]"
        >
          <option value="">Size</option>
          <option value="2">Small</option>
          <option value="3">Normal</option>
          <option value="5">Large</option>
          <option value="7">Extra Large</option>
        </select>
        <input
          type="color"
          defaultValue="#101828"
          aria-label="Text color"
          title="Text color"
          onChange={(event) => run("foreColor", event.target.value)}
          className="h-8 w-9 cursor-pointer rounded-md border border-[#D0D5DD] bg-white p-1"
        />
        <Divider />
        <Tool label="•≡" title="Bullet list" onMouseDown={keepSelection} onClick={() => run("insertUnorderedList")} />
        <Tool label="1≡" title="Numbered list" onMouseDown={keepSelection} onClick={() => run("insertOrderedList")} />
        <Tool label="↔" title="Center align" onMouseDown={keepSelection} onClick={() => run("justifyCenter")} />
        <Tool label="⌫ Format" title="Clear formatting" onMouseDown={keepSelection} onClick={() => run("removeFormat")} wide />
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={(event) => onChange(sanitizeInstructionHtml(event.currentTarget.innerHTML))}
        className="instruction-editor min-h-28 max-h-52 overflow-y-auto px-3 py-2.5 text-sm leading-6 text-[#344054] outline-none empty:before:pointer-events-none empty:before:text-[#98A2B3] empty:before:content-[attr(data-placeholder)] [&_ol]:ml-5 [&_ol]:list-decimal [&_ul]:ml-5 [&_ul]:list-disc"
      />
    </div>
  );
}

function Tool({ label, title, onClick, onMouseDown, className = "", wide = false }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={onMouseDown}
      onClick={onClick}
      className={`${wide ? "w-auto px-2" : "w-8"} h-8 rounded-md border border-[#D0D5DD] bg-white text-xs text-[#344054] hover:border-[#2554C7] hover:text-[#2554C7] ${className}`}
    >
      {label}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-[#D0D5DD]" />;
}
