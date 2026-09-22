import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient as QueryGuest, QueryClientProvider as QueryGuestProvider } from "@tanstack/react-query";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import App from "./App.jsx";
import { RealtimeProvider } from "./realtime/RealtimeContext.jsx";
import "./index.css";

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
} else if ("serviceWorker" in navigator) {
  // A production worker can otherwise keep controlling localhost during
  // development and serve stale application files.
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
  if ("caches" in window) {
    caches.keys().then((keys) => {
      keys.filter((key) => key.startsWith("quantum-crm-shell-")).forEach((key) => caches.delete(key));
    });
  }
}

const queryGuest = new QueryGuest({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryGuestProvider client={queryGuest}>
        <RealtimeProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </RealtimeProvider>
      </QueryGuestProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
