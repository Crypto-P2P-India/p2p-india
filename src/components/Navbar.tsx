import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Link } from "react-router-dom";
import { Wallet } from "lucide-react";
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
            {native ? (
              <ConnectButton.Custom>
                {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
                  const ready = mounted;
                  const connected = ready && account && chain;
                  return (
                    <div
                      {...(!ready && {
                        "aria-hidden": true,
                        style: { opacity: 0, pointerEvents: "none", userSelect: "none" },
                      })}
                    >
                      {!connected ? (
                        <button
                          onClick={openConnectModal}
                          aria-label="Connect Wallet"
                          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/20 active:scale-95 transition-transform"
                        >
                          <Wallet className="h-5 w-5" />
                        </button>
                      ) : chain.unsupported ? (
                        <button
                          onClick={openChainModal}
                          aria-label="Wrong network"
                          className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive text-destructive-foreground active:scale-95 transition-transform"
                        >
                          <Wallet className="h-5 w-5" />
                        </button>
                      ) : (
                        <button
                          onClick={openAccountModal}
                          aria-label="Account"
                          className="flex h-10 items-center gap-1.5 rounded-full bg-card border border-border px-3 active:scale-95 transition-transform"
                        >
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary">
                            <Wallet className="h-3.5 w-3.5" />
                          </span>
                          <span className="text-xs font-semibold text-foreground">
                            {account.displayName}
                          </span>
                        </button>
                      )}
                    </div>
                  );
                }}
              </ConnectButton.Custom>
            ) : (
              <ConnectButton chainStatus="icon" accountStatus="avatar" showBalance={false} />
            )}
          </div>
        </div>
      </nav>
      {/* Spacer to offset fixed navbar height (including safe-area inset) */}
      <div aria-hidden className="h-14 sm:h-20" style={{ paddingTop: "env(safe-area-inset-top)" }} />
    </>
  );
};

export default Navbar;
