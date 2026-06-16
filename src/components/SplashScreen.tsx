import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/platform";

const SplashScreen = () => {
  const [visible, setVisible] = useState(() => isNativeApp());
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) return;
    if (typeof window !== "undefined" && sessionStorage.getItem("splash_shown") === "1") {
      setVisible(false);
      return;
    }
    const fadeTimer = setTimeout(() => setFading(true), 1200);
    const hideTimer = setTimeout(() => {
      setVisible(false);
      try { sessionStorage.setItem("splash_shown", "1"); } catch {}
    }, 1800);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        fading ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      aria-hidden="true"
    >
      <img
        src="/logo.png"
        alt="Crypto P2P"
        className="w-28 h-28 md:w-36 md:h-36 object-contain animate-scale-in drop-shadow-[0_0_30px_hsl(var(--primary)/0.35)]"
      />
      <div className="mt-5 text-center animate-fade-in">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          Crypto P2P
        </h1>
        <p className="mt-1 text-xs md:text-sm text-muted-foreground">
          Secure on-chain escrow
        </p>
      </div>
      <div className="absolute bottom-10 flex gap-1.5">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse [animation-delay:150ms]" />
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse [animation-delay:300ms]" />
      </div>
    </div>
  );
};

export default SplashScreen;
