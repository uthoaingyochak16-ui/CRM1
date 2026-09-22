import DOMPurify from "dompurify";

const SANITIZE_OPTIONS = {
  ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "span", "br", "p", "div", "ul", "ol", "li", "font"],
  ALLOWED_ATTR: ["style", "color", "size"],
};

export function sanitizeInstructionHtml(html) {
  return DOMPurify.sanitize(html || "", SANITIZE_OPTIONS);
}
