import { useEffect, useState } from "react";
import { useAccount, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { QRCodeSVG } from "qrcode.react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Wallet, ExternalLink, CheckCircle2, QrCode, Smartphone, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type WalletApp = {
  id: string;
  name: string;
  icon: string;
  connectorNames: string[];
};

const WALLETS: WalletApp[] = [
  {
    id: "metamask",
    name: "MetaMask",
    icon: "🦊",
    connectorNames: ["MetaMask"],
  },
  {
    id: "okx",
    name: "OKX Wallet",
    icon: "⚫",
    connectorNames: ["OKX Wallet", "OKX"],
  },
  {
    id: "trust",
    name: "Trust Wallet",
    icon: "🛡️",
    connectorNames: ["Trust Wallet", "Trust"],
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
  const { openConnectModal } = useConnectModal();
  const [hasInjected, setHasInjected] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);
  const [qrUri, setQrUri] = useState<string | null>(null);

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
    setQrUri(null);
    onOpenChange(false);
  }, [isConnected, onOpenChange, open]);

  useEffect(() => {
    if (open) return;
    setConnectingWallet(null);
    setQrUri(null);
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

  const findQrConnector = () =>
    connectors.find(
      (c) =>
        c.id === "walletConnect" &&
        !(c as typeof c & { rkDetails?: { showQrModal?: boolean; isWalletConnectModalConnector?: boolean } }).rkDetails
          ?.showQrModal &&
        !(c as typeof c & { rkDetails?: { isWalletConnectModalConnector?: boolean } }).rkDetails?.isWalletConnectModalConnector
    ) ?? connectors.find((c) => c.id === "walletConnect" || c.name.toLowerCase().includes("walletconnect"));

  const startQrConnect = async () => {
    const connector = findQrConnector();
    if (!connector) {
      toast.error("QR connection unavailable", { description: "Use Other wallets to open the full wallet list." });
      openConnectModal?.();
      return;
    }

    setQrUri(null);
    setConnectingWallet("qr");
    const handleMessage = (message: { type: string; data?: unknown }) => {
      if (message.type === "display_uri" && typeof message.data === "string") {
        setQrUri(message.data);
        toast.success("QR ready", { id: "wallet-connect" });
      }
    };

    connector.emitter.on("message", handleMessage);
    toast.loading("Creating QR code…", {
      id: "wallet-connect",
      description: "Scan it with your wallet app to connect.",
      duration: 4000,
    });

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

  const connectWalletApp = (w: WalletApp) => {
    const connector = findWalletConnector(w);
    if (!connector) {
      toast.error(`${w.name} is not available`, {
        description: "Use Other wallets to connect with WalletConnect.",
      });
      openConnectModal?.();
      return;
    }

    setConnectingWallet(w.id);
    toast.loading(`Opening ${w.name}…`, {
      id: "wallet-connect",
      description: "Approve the connection inside your wallet app, then return here.",
      duration: 4000,
    });
    connect(
      { connector },
      {
        onSuccess: () => {
          toast.success("Wallet connected", { id: "wallet-connect" });
          onOpenChange(false);
        },
        onError: (error) => {
          setConnectingWallet(null);
          toast.error("Wallet connection failed", { id: "wallet-connect", description: error.message });
        },
      }
    );
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
              : "Connect directly to the wallet app installed on this phone."}
          </SheetDescription>
        </SheetHeader>

        <div className="p-5 space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="font-semibold text-foreground">Scan QR to connect</p>
                <p className="text-xs text-muted-foreground">Open any wallet app and scan this code.</p>
              </div>
              <QrCode className="h-5 w-5 text-primary" />
            </div>
            {qrUri ? (
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-xl bg-white p-3">
                  <QRCodeSVG value={qrUri} size={210} level="M" includeMargin />
                </div>
                <p className="text-center text-xs text-muted-foreground">After scanning, approve in the wallet app and return here.</p>
              </div>
            ) : (
              <Button
                onClick={startQrConnect}
                disabled={isPending || connectingWallet === "qr"}
                className="w-full h-14 text-base font-semibold gap-2"
              >
                {connectingWallet === "qr" ? <RefreshCw className="h-5 w-5 animate-spin" /> : <QrCode className="h-5 w-5" />}
                {connectingWallet === "qr" ? "Preparing QR…" : "Show Wallet QR"}
              </Button>
            )}
          </div>

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

          <div className="pt-2 border-t border-border/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
              Other options
            </p>
            <button
              onClick={useWalletConnectFallback}
              className="w-full flex items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border hover:bg-muted/60 active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <p className="font-semibold text-foreground">Other wallets</p>
                  <p className="text-xs text-muted-foreground">Use WalletConnect / full wallet list</p>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileWalletSheet;
