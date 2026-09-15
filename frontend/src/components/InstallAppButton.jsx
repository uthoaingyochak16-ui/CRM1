import { useEffect, useState } from "react";

export default function InstallAppButton({ compact = false }) {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(() => window.matchMedia("(display-mode: standalone)").matches);

  useEffect(() => {
    const capturePrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const markInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  if (installed || !installPrompt) return null;

  async function installApp() {
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallPrompt(null);
  }

  return (
    <button
      type="button"
      onClick={installApp}
      title="Install PC App"
      className={`mb-1.5 flex w-full items-center rounded-lg px-3 py-2 text-xs font-semibold text-[#2554C7] hover:bg-[#EEF4FF] ${compact ? "justify-center px-2" : "gap-2"}`}
    >
      <i className="ti ti-device-desktop-down" style={{ fontSize: 16 }} aria-hidden="true" />
      {!compact && <span>Install PC App</span>}
    </button>
  );
}
