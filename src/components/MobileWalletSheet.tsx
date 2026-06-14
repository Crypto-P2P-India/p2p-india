import { useEffect, useState } from "react";
import { useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Wallet, ExternalLink, QrCode, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const SITE = "crypto-p2p.store";
const SITE_URL = `https://${SITE}`;

type WalletApp = {
  name: string;
  icon: string;
  deepLink: string; // opens the wallet's in-app browser to SITE_URL
};

const WALLETS: WalletApp[] = [
  {
    name: "MetaMask",
    icon: "🦊",
    deepLink: `https://metamask.app.link/dapp/${SITE}`,
  },
  {
    name: "Trust Wallet",
    icon: "🛡️",
    deepLink: `https://link.trustwallet.com/open_url?coin_id=20000714&url=${encodeURIComponent(SITE_URL)}`,
  },
  {
    name: "OKX Wallet",
    icon: "⚫",
    deepLink: `okx://wallet/dapp/url?dappUrl=${encodeURIComponent(SITE_URL)}`,
  },
  {
    name: "Bitget Wallet",
    icon: "🟦",
    deepLink: `https://bkcode.vip?action=dapp&url=${encodeURIComponent(SITE_URL)}`,
  },
  {
    name: "Coinbase Wallet",
    icon: "🔵",
    deepLink: `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(SITE_URL)}`,
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MobileWalletSheet = ({ open, onOpenChange }: Props) => {
  const { connectors, connect, isPending } = useConnect();
  const { openConnectModal } = useConnectModal();
  const [hasInjected, setHasInjected] = useState(false);

  useEffect(() => {
    // Detect injected provider (we are inside a wallet's in-app browser)
    const check = () => setHasInjected(typeof window !== "undefined" && !!(window as any).ethereum);
    check();
    const t = setTimeout(check, 400);
    return () => clearTimeout(t);
  }, [open]);

  const connectInjected = () => {
    const inj = connectors.find((c) => c.id === "injected" || c.type === "injected");
    if (inj) {
      connect({ connector: inj });
    } else {
      connect({ connector: injected() });
    }
    onOpenChange(false);
  };

  const openInWallet = (w: WalletApp) => {
    toast.loading(`Opening ${w.name}…`, {
      id: "wallet-dapp",
      description: "The wallet will open this app inside its built-in browser.",
      duration: 4000,
    });
    try {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = w.deepLink;
      document.body.appendChild(iframe);
      setTimeout(() => iframe.remove(), 1500);
    } catch {
      window.location.href = w.deepLink;
    }
  };

  const useWalletConnectFallback = () => {
    onOpenChange(false);
    setTimeout(() => openConnectModal?.(), 200);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-t border-border max-h-[92vh] overflow-y-auto p-0"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
      >
        <SheetHeader className="p-5 text-left border-b border-border/50">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <Wallet className="h-5 w-5 text-primary" />
            Connect Wallet
          </SheetTitle>
          <SheetDescription>
            {hasInjected
              ? "Wallet detected. Tap connect to approve."
              : "Open this app inside your wallet's built-in browser for the most reliable connection."}
          </SheetDescription>
        </SheetHeader>

        <div className="p-5 space-y-4">
          {hasInjected && (
            <Button
              onClick={connectInjected}
              disabled={isPending}
              className="w-full h-14 text-base font-semibold gap-2"
            >
              <CheckCircle2 className="h-5 w-5" />
              {isPending ? "Connecting…" : "Connect Detected Wallet"}
            </Button>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
              Open in wallet browser (recommended)
            </p>
            <div className="space-y-2">
              {WALLETS.map((w) => (
                <button
                  key={w.name}
                  onClick={() => openInWallet(w)}
                  className="w-full flex items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border hover:bg-muted/60 active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{w.icon}</span>
                    <span className="font-semibold text-foreground">{w.name}</span>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-border/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
              Other options
            </p>
            <button
              onClick={useWalletConnectFallback}
              className="w-full flex items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border hover:bg-muted/60 active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-3">
                <QrCode className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <p className="font-semibold text-foreground">WalletConnect</p>
                  <p className="text-xs text-muted-foreground">Scan QR with another device</p>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <p className="text-[11px] text-muted-foreground text-center px-2 pt-2">
            Tip: Inside your wallet app, open the in-app browser and visit{" "}
            <span className="font-mono text-foreground">{SITE}</span> — connection will be instant.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileWalletSheet;
