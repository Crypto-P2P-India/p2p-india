import { useEffect, useState } from "react";
import { useAccount, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Wallet, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type WalletApp = {
  id: string;
  name: string;
  icon: string;
  connectorNames: string[];
  getDeepLink?: (uri: string) => string;
};

const encodeWalletUri = (uri: string) => encodeURIComponent(uri);

const WALLETS: WalletApp[] = [
  {
    id: "metamask",
    name: "MetaMask",
    icon: "🦊",
    connectorNames: ["MetaMask"],
    getDeepLink: (uri) => `https://metamask.app.link/wc?uri=${encodeWalletUri(uri)}`,
  },
  {
    id: "okx",
    name: "OKX Wallet",
    icon: "⚫",
    connectorNames: ["OKX Wallet", "OKX"],
    getDeepLink: (uri) => `okx://wallet/wc?uri=${encodeWalletUri(uri)}`,
  },
  {
    id: "bitget",
    name: "Bitget Wallet",
    icon: "🟢",
    connectorNames: ["Bitget Wallet", "Bitget", "BitKeep"],
    getDeepLink: (uri) => `https://bkcode.vip/wc?uri=${encodeWalletUri(uri)}`,
  },
  {
    id: "binance",
    name: "Binance Wallet",
    icon: "🟡",
    connectorNames: ["Binance Wallet", "Binance"],
    getDeepLink: (uri) => `bnc://app.binance.com/cedefi/wc?uri=${encodeWalletUri(uri)}`,
  },
  {
    id: "trust",
    name: "Trust Wallet",
    icon: "🛡️",
    connectorNames: ["Trust Wallet", "Trust"],
    getDeepLink: (uri) => `https://link.trustwallet.com/wc?uri=${encodeWalletUri(uri)}`,
  },
  {
    id: "bybit",
    name: "Bybit Wallet",
    icon: "🟠",
    connectorNames: ["Bybit Wallet", "Bybit"],
    getDeepLink: (uri) => `bybitapp://open?targetUrl=bybitapp%3A%2F%2Fwallet%2Fwc%3Furi%3D${encodeWalletUri(uri)}`,
  },
  {
    id: "tokenpocket",
    name: "TokenPocket",
    icon: "🟣",
    connectorNames: ["TokenPocket", "Token Pocket"],
    getDeepLink: (uri) => `tpoutside://wc?uri=${encodeWalletUri(uri)}`,
  },
  {
    id: "imtoken",
    name: "imToken",
    icon: "🔷",
    connectorNames: ["imToken"],
    getDeepLink: (uri) => `imtokenv2://wc?uri=${encodeWalletUri(uri)}`,
  },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    icon: "🔵",
    connectorNames: ["Coinbase Wallet", "Coinbase"],
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MobileWalletSheet = ({ open, onOpenChange }: Props) => {
  const { connectors, connect, connectAsync, isPending } = useConnect();
  const { isConnected } = useAccount();
  const [hasInjected, setHasInjected] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);

  useEffect(() => {
    const check = () =>
      setHasInjected(typeof window !== "undefined" && !!(window as Window & { ethereum?: unknown }).ethereum);
    check();
    const t = setTimeout(check, 400);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open || !isConnected) return;
    setConnectingWallet(null);
    onOpenChange(false);
  }, [isConnected, onOpenChange, open]);

  useEffect(() => {
    if (open) return;
    setConnectingWallet(null);
  }, [open]);

  const connectInjected = () => {
    const inj = connectors.find((c) => c.id === "injected" || c.type === "injected");
    setConnectingWallet("detected");
    connect(
      { connector: inj ?? injected() },
      {
        onSuccess: () => onOpenChange(false),
        onError: (error) => {
          setConnectingWallet(null);
          toast.error("Wallet connection failed", { description: error.message });
        },
      }
    );
  };

  const findWalletConnector = (w: WalletApp) =>
    connectors.find((c) => w.connectorNames.some((name) => c.name.toLowerCase().includes(name.toLowerCase())));

  const openWalletDeepLink = (w: WalletApp, uri: string) => {
    const deepLink = w.getDeepLink?.(uri);
    if (!deepLink) return;
    if (/^https?:/i.test(deepLink)) {
      window.location.href = deepLink;
      return;
    }
    window.open(deepLink, "_system");
  };

  const connectWalletApp = async (w: WalletApp) => {
    const connector = findWalletConnector(w);
    if (!connector) {
      toast.error(`${w.name} is not available`, {
        description: "Install or update the wallet app, then try again.",
      });
      return;
    }

    setConnectingWallet(w.id);
    toast.loading(`Opening ${w.name}…`, {
      id: "wallet-connect",
      description: "Approve the connection inside your wallet app, then return here.",
      duration: 4000,
    });
    const handleMessage = (message: { type: string; data?: unknown }) => {
      if (message.type === "display_uri" && typeof message.data === "string") {
        openWalletDeepLink(w, message.data);
      }
    };

    connector.emitter.on("message", handleMessage);
    try {
      await connectAsync({ connector });
      toast.success("Wallet connected", { id: "wallet-connect" });
      onOpenChange(false);
    } catch (error) {
      setConnectingWallet(null);
      toast.error("Wallet connection failed", {
        id: "wallet-connect",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      connector.emitter.off("message", handleMessage);
    }
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
              : "Connect directly to the wallet app installed on this phone."}
          </SheetDescription>
        </SheetHeader>

        <div className="p-5 space-y-4">
          {hasInjected && (
            <Button
              onClick={connectInjected}
              disabled={isPending || connectingWallet === "detected"}
              className="w-full h-14 text-base font-semibold gap-2"
            >
              <CheckCircle2 className="h-5 w-5" />
              {connectingWallet === "detected" ? "Connecting…" : "Connect Detected Wallet"}
            </Button>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
              Connect wallet app
            </p>
            <div className="space-y-2">
              {WALLETS.map((w) => (
                <button
                  key={w.name}
                  onClick={() => connectWalletApp(w)}
                  disabled={isPending}
                  className="w-full flex items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border hover:bg-muted/60 active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{w.icon}</span>
                    <div className="text-left">
                      <p className="font-semibold text-foreground">{w.name}</p>
                      {connectingWallet === w.id && <p className="text-xs text-muted-foreground">Waiting for approval…</p>}
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>

        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileWalletSheet;
