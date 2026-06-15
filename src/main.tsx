import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { toast } from "sonner";

// In Capacitor Android WebView, `window.open('wc:...')` and similar
// wallet deep links are silently dropped. We override window.open AND
// anchor clicks so any non-http(s) scheme is dispatched via a hidden iframe
// navigation — this reliably triggers Android's shouldOverrideUrlLoading
// with the FULL URI (including the WalletConnect `uri` query param)
// preserved, so OKX / Trust / MetaMask can receive the connection
// request and prompt the user.
if (Capacitor.isNativePlatform()) {
  setTimeout(() => {
    SplashScreen.hide().catch(() => undefined);
  }, 1500);

  const walletNameFromScheme = (href: string): string | null => {
    const scheme = href.split(":")[0].toLowerCase();
    if (scheme.startsWith("okx") || scheme.startsWith("okex")) return "OKX Wallet";
    if (scheme.startsWith("metamask")) return "MetaMask";
    if (scheme.startsWith("trust")) return "Trust Wallet";
    if (scheme.startsWith("rainbow")) return "Rainbow";
    if (scheme.startsWith("imtokenv2") || scheme.startsWith("imtoken")) return "imToken";
    if (scheme.startsWith("tpoutside") || scheme.startsWith("tokenpocket")) return "TokenPocket";
    if (scheme.startsWith("bitkeep")) return "Bitget Wallet";
    if (scheme.startsWith("wc")) return "Wallet";
    return null;
  };

  const openNative = (href: string) => {
    const walletName = walletNameFromScheme(href);
    if (walletName) {
      toast.loading(`Opening ${walletName}…`, {
        id: "wallet-deeplink",
        description: "Approve the connection request inside the wallet app.",
        duration: 4000,
      });
    }
    try {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = href;
      document.body.appendChild(iframe);
      setTimeout(() => iframe.remove(), 1500);
    } catch {
      try {
        window.location.href = href;
      } catch {
        /* ignore */
      }
    }
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
