export function reloadPage(state = {}) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent("qf:refresh-current-view", { detail: state }));
}

export function consumeReloadState() {
  return null;
}
