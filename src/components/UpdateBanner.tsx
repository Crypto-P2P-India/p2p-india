import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { APP_VERSION, VERSION_MANIFEST_URL, isNativeApp } from "@/lib/platform";

/**
 * Shows a top banner inside the installed Android app when a newer APK is
 * available on the website. Compares bundled APP_VERSION with the remote
 * manifest at VERSION_MANIFEST_URL. Tap "Update" to download the new APK.
 */
const DISMISS_KEY = "update-banner-dismissed-version";

const cmp = (a: string, b: string) => {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
};

const UpdateBanner = () => {
  const [latest, setLatest] = useState<{ version: string; apkUrl: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;
    const check = async () => {
      try {
        const r = await fetch(`${VERSION_MANIFEST_URL}?t=${Date.now()}`, { cache: "no-store" });
        if (!r.ok) return;
        const data = await r.json();
        if (cancelled || !data?.version) return;
        if (cmp(data.version, APP_VERSION) > 0) {
          const skipped = localStorage.getItem(DISMISS_KEY);
          if (skipped !== data.version) {
            setLatest({ version: data.version, apkUrl: data.apkUrl });
          }
        }
      } catch {
        /* offline / ignore */
      }
    };
    check();
    const id = setInterval(check, 1000 * 60 * 30); // every 30 min
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!latest || dismissed) return null;

  const rawApkAbs = latest.apkUrl.startsWith("http")
    ? latest.apkUrl
    : `https://crypto-p2p.store${latest.apkUrl}`;
  const apkAbs = `${rawApkAbs}${rawApkAbs.includes("?") ? "&" : "?"}t=${Date.now()}`;

  return (
    <div
      className="fixed inset-x-0 z-[60] bg-primary text-primary-foreground shadow-lg"
      style={{ top: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
        <Download className="h-4 w-4 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold leading-tight">
            Update available — v{latest.version}
          </p>
          <p className="text-[10px] opacity-80 leading-tight">
            You're on v{APP_VERSION}. Tap update to get the latest APK.
          </p>
        </div>
        <a
          href={apkAbs}
          download={`crypto-p2p-v${latest.version}.apk`}
          className="rounded-full bg-primary-foreground/15 px-3 py-1 text-[11px] font-bold backdrop-blur hover:bg-primary-foreground/25 active:scale-95 transition"
        >
          Update
        </a>
        <button
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, latest.version);
            setDismissed(true);
          }}
          aria-label="Dismiss"
          className="p-1 opacity-70 hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default UpdateBanner;
