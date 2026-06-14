import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";

// In Capacitor Android WebView, `window.open('okx://wc?uri=...')` and similar
// wallet deep links are silently dropped. We override window.open AND
// window.location.href assignments so any non-http(s) scheme is dispatched
// through Capacitor's native App.openUrl, which calls Android's
// Intent.ACTION_VIEW with the FULL URI (including the WalletConnect `uri`
// query param) preserved. This ensures OKX / Trust / MetaMask receive the
// connection request and prompt the user — not just open blank.
if (Capacitor.isNativePlatform()) {
  const openNative = (href: string) => {
    // Fire-and-forget; Android intent dispatch is async.
    CapacitorApp.openUrl({ url: href }).catch(() => {
      // Last-ditch fallback
      try {
        window.location.href = href;
      } catch {
        /* ignore */
      }
    });
  };

  const isCustomScheme = (href: string) =>
    !!href &&
    !/^https?:\/\//i.test(href) &&
    !href.startsWith("about:") &&
    !href.startsWith("blob:") &&
    !href.startsWith("data:") &&
    !href.startsWith("#") &&
    !href.startsWith("/");

  // 1) window.open override
  const originalOpen = window.open.bind(window);
  window.open = ((url?: string | URL, target?: string, features?: string) => {
    try {
      const href = typeof url === "string" ? url : url?.toString() ?? "";
      if (isCustomScheme(href)) {
        openNative(href);
        return null;
      }
    } catch {
      /* fall through */
    }
    return originalOpen(url as string, target, features);
  }) as typeof window.open;

  // 2) Intercept anchor clicks with custom-scheme hrefs
  document.addEventListener(
    "click",
    (e) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      if (isCustomScheme(href)) {
        e.preventDefault();
        openNative(href);
      }
    },
    true
  );
}

createRoot(document.getElementById("root")!).render(<App />);
