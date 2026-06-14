import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, ArrowLeftRight, ShoppingBag, Handshake, PlusCircle, Info, BookOpen, FileText, Shield, MessageCircle, Wallet } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useGlobalUnreadCount } from "@/hooks/useGlobalUnreadCount";

const TG_LINK = "https://t.me/Xplorertobi38";

const PRIMARY = [
  { label: "P2P Marketplace", href: "/", icon: ArrowLeftRight },
  { label: "My Ads", href: "/my-ads", icon: ShoppingBag },
  { label: "My Deals", href: "/my-orders", icon: Handshake, badge: true },
];

const SECONDARY = [
  { label: "About", href: "/about", icon: Info },
  { label: "Guide", href: "/guide", icon: BookOpen },
  { label: "Terms", href: "/terms", icon: FileText },
  { label: "Privacy", href: "/privacy", icon: Shield },
];

const SideMenu = () => {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { address } = useAccount();
  const unread = useGlobalUnreadCount(address);

  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Open menu"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-foreground active:bg-muted/60 transition-colors"
        >
          <Menu className="h-6 w-6" strokeWidth={2.25} />
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[82%] max-w-sm p-0 flex flex-col"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5cm)" }}
      >
        <SheetHeader className="p-5 border-b border-border/50 text-left">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <img src="/favicon.png" alt="Crypto P2P" className="h-7 w-7" />
            </div>
            <SheetTitle className="text-lg font-bold">Crypto P2P</SheetTitle>
          </div>
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto p-3">
          <div className="space-y-1">
            {PRIMARY.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              const showBadge = item.badge && unread > 0;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={close}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${
                    active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted/60"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="flex-1">{item.label}</span>
                  {showBadge && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </Link>
              );
            })}

            <button
              onClick={() => {
                close();
                window.dispatchEvent(new CustomEvent("open-create-modal"));
              }}
              className="mt-2 flex w-full items-center gap-3 rounded-xl bg-primary px-3 py-3 text-sm font-bold text-primary-foreground shadow-md shadow-primary/20 active:scale-[0.98] transition-transform"
            >
              <PlusCircle className="h-5 w-5" />
              <span>Post Ad</span>
            </button>
          </div>

          {/* Wallet */}
          <div className="mt-5 pt-4 border-t border-border/50">
            <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Wallet
            </p>
            <ConnectButton.Custom>
              {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
                const ready = mounted;
                const connected = ready && account && chain;
                return (
                  <button
                    onClick={() => {
                      if (!connected) openConnectModal();
                      else if (chain.unsupported) openChainModal();
                      else openAccountModal();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-muted/40 px-3 py-3 text-sm font-semibold text-foreground active:scale-[0.98] transition-transform"
                  >
                    <Wallet className="h-5 w-5 text-primary" />
                    <span className="flex-1 text-left truncate">
                      {connected ? account.displayName : "Connect Wallet"}
                    </span>
                    {connected && (
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {chain.unsupported ? "Wrong net" : chain.name}
                      </span>
                    )}
                  </button>
                );
              }}
            </ConnectButton.Custom>

            <a
              href={TG_LINK}
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
              className="mt-2 flex w-full items-center gap-3 rounded-xl border border-border/60 bg-muted/40 px-3 py-3 text-sm font-semibold text-foreground active:scale-[0.98] transition-transform"
            >
              <MessageCircle className="h-5 w-5 text-primary" />
              <span className="flex-1 text-left">Support</span>
              <span className="text-[10px] font-bold text-muted-foreground">Telegram</span>
            </a>
          </div>


          <div className="mt-6 pt-4 border-t border-border/50">
            <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              More
            </p>
            <div className="space-y-1">
              {SECONDARY.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={close}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                      active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-border/50 text-[11px] text-muted-foreground">
          Crypto P2P · v1.6
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SideMenu;
