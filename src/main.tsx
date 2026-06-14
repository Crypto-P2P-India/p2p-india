import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Capacitor } from "@capacitor/core";

// In Capacitor Android WebView, `window.open('okx://...')` and similar deep
// links to wallet apps are silently dropped by the WebView. By rerouting
// non-http(s) schemes through `window.location.href`, Capacitor's
// WebViewClient picks them up via shouldOverrideUrlLoading and dispatches an
// Android Intent, which actually launches the installed wallet (OKX, Trust,
// MetaMask, etc.).
if (Capacitor.isNativePlatform()) {
  const originalOpen = window.open.bind(window);
  window.open = ((url?: string | URL, target?: string, features?: string) => {
    try {
      const href = typeof url === "string" ? url : url?.toString() ?? "";
      if (href && !/^https?:\/\//i.test(href) && !href.startsWith("about:")) {
        // Custom scheme (wc:, okx:, metamask:, trust:, cbwallet:, etc.)
        window.location.href = href;
        return null;
      }
    } catch {
      /* fall through */
    }
    return originalOpen(url as string, target, features);
  }) as typeof window.open;
}

createRoot(document.getElementById("root")!).render(<App />);
