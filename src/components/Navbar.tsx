import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Link } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";
import ApkDownloadButton from "@/components/ApkDownloadButton";
import SideMenu from "@/components/SideMenu";
import { isNativeApp } from "@/lib/platform";

const Navbar = () => {
  const native = isNativeApp();

  return (
    <>
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-background/70 backdrop-blur-xl">
        {/* Safe area spacer for mobile notch */}
        <div className="h-[env(safe-area-inset-top)] bg-background/70" />
        <div className="mx-auto flex h-14 sm:h-20 max-w-7xl items-center justify-between gap-2 px-3 sm:px-6">
          {/* Left: hamburger on native, logo+name on web */}
          {native ? (
            <SideMenu />
          ) : (
            <Link to="/" className="flex items-center gap-2 min-w-0 shrink-0">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center overflow-hidden shadow-lg shadow-primary/20 shrink-0">
                <img src="/favicon.png" alt="Crypto P2P" className="h-6 w-6" />
              </div>
              <span className="text-base sm:text-xl font-bold tracking-tight text-foreground whitespace-nowrap">
                Crypto P2P
              </span>
            </Link>
          )}

          {/* Right side */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {!native && <ApkDownloadButton />}
            <ThemeToggle />
            <div className="scale-75 origin-right -mr-2">
              <ConnectButton chainStatus="icon" accountStatus="avatar" showBalance={false} />
            </div>
          </div>
        </div>
      </nav>
      {/* Spacer to offset fixed navbar height (including safe-area inset) */}
      <div aria-hidden className="h-14 sm:h-20" style={{ paddingTop: "env(safe-area-inset-top)" }} />
    </>
  );
};

export default Navbar;
