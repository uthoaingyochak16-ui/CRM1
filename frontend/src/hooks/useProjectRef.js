import { useSearchParams } from "react-router-dom";

// New public URLs use an opaque, keyless query token: /?a4f39c2d...
// q/project are accepted only for backward compatibility with existing links.
export function readProjectRef(searchParams) {
  const namedRef = searchParams.get("q") || searchParams.get("project");
  if (namedRef) return namedRef;
  for (const [key, value] of searchParams.entries()) {
    if (!value && key && !["payment", "tran_id"].includes(key)) return key;
  }
  return "";
}

export default function useProjectRef() {
  const [searchParams] = useSearchParams();
  return readProjectRef(searchParams);
}

export function withProjectParam(path, projectRef) {
  if (!projectRef) return path;
  const sep = path.includes("?") ? "&q=" : "?";
  return `${path}${sep}${encodeURIComponent(projectRef)}`;
}
