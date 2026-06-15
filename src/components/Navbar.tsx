import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Link, useLocation } from "react-router-dom";
import { Wallet, ShoppingBag, Handshake, Store, User } from "lucide-react";
import { useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import ApkDownloadButton from "@/components/ApkDownloadButton";
import SideMenu from "@/components/SideMenu";
import MobileWalletSheet from "@/components/MobileWalletSheet";
import { isNativeApp, useAppStyleUI } from "@/lib/platform";
import { useAccount } from "wagmi";
import { useGlobalUnreadCount } from "@/hooks/useGlobalUnreadCount";

const Navbar = () => {
  const appStyle = useAppStyleUI();
  const native = appStyle;
  const { pathname } = useLocation();
  const { address } = useAccount();
  const unread = useGlobalUnreadCount(address);
  const [walletSheetOpen, setWalletSheetOpen] = useState(false);

  const desktopLinks = [
    { label: "Marketplace", href: "/", icon: Store },
    { label: "My Ads", href: "/my-ads", icon: ShoppingBag },
    { label: "My Deals", href: "/my-orders", icon: Handshake, badge: true },
  ];

  return (
    <>
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-background/70 backdrop-blur-xl">
        {/* Safe area spacer for mobile notch — only inside native app */}
        {isNativeApp() && <div className="h-[env(safe-area-inset-top)] bg-background/70" />}
        <div className="mx-auto flex h-14 sm:h-20 max-w-7xl items-center justify-between gap-2 px-3 sm:px-6">
          {/* Left */}
          {native ? (
            <SideMenu />
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              {/* Mobile-web hamburger */}
              <div className="md:hidden">
                <SideMenu />
              </div>
              <Link to="/" className="flex items-center gap-2 min-w-0 shrink-0">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center overflow-hidden shadow-lg shadow-primary/20 shrink-0">
                  <img src="/favicon.png" alt="Crypto P2P" className="h-6 w-6" />
                </div>
                <span className="text-base sm:text-xl font-bold tracking-tight text-foreground whitespace-nowrap">
                  Crypto P2P
                </span>
              </Link>
              {/* Desktop nav links */}
              <div className="hidden md:flex items-center gap-1 ml-6">
                {desktopLinks.map((l) => {
                  const Icon = l.icon;
                  const active = pathname === l.href;
                  const showBadge = l.badge && unread > 0;
                  return (
                    <Link
                      key={l.href}
                      to={l.href}
                      className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{l.label}</span>
                      {showBadge && (
                        <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
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
                          onClick={() => setWalletSheetOpen(true)}
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
              <div className="scale-90 origin-right">
                <ConnectButton chainStatus="icon" accountStatus="avatar" showBalance={false} label="Connect" />
              </div>
            )}
          </div>
        </div>
      </nav>
      {/* Spacer to offset fixed navbar height (+ safe-area inset only in native app) */}
      <div
        aria-hidden
        style={{ height: isNativeApp() ? "calc(3.5rem + env(safe-area-inset-top) + 0.25cm)" : "calc(3.5rem + 0.25cm)" }}
        className={isNativeApp() ? "sm:!h-[calc(5rem+env(safe-area-inset-top)+0.25cm)]" : "sm:!h-[calc(5rem+0.25cm)]"}
      />

      {native && <MobileWalletSheet open={walletSheetOpen} onOpenChange={setWalletSheetOpen} />}
    </>
  );
};

export default Navbar;
