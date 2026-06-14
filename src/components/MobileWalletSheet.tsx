import { useEffect, useMemo, useState } from "react";
import { useAccount, useConnect, type Connector } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Wallet, QrCode, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Map UI wallets to RainbowKit connector id substrings.
// Each entry uses that wallet's own SDK / native deep-link under the hood.
const WALLETS: { name: string; icon: string; match: RegExp; note: string }[] = [
  { name: "MetaMask",        icon: "🦊", match: /metaMask|io\.metamask/i,         note: "MetaMask SDK" },
  { name: "OKX Wallet",      icon: "⚫", match: /okx/i,                           note: "OKX deep-link" },
  { name: "Trust Wallet",    icon: "🛡️", match: /trust/i,                         note: "WalletConnect v2" },
  { name: "Coinbase Wallet", icon: "🔵", match: /coinbase/i,                      note: "Coinbase SDK" },
  { name: "Rabby",           icon: "🐰", match: /rabby/i,                         note: "Rabby Mobile" },
  { name: "Bitget Wallet",   icon: "🟦", match: /bitget|bitKeep/i,                note: "WalletConnect v2" },
  { name: "Binance Wallet",  icon: "🟡", match: /binance/i,                       note: "Binance SDK" },
  { name: "Phantom",         icon: "👻", match: /phantom/i,                       note: "Phantom" },
];

const MobileWalletSheet = ({ open, onOpenChange }: Props) => {
  const { connectors, connectAsync, isPending } = useConnect();
  const { openConnectModal } = useConnectModal();
  const { isConnected } = useAccount();
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [hasInjected, setHasInjected] = useState(false);

  useEffect(() => {
    const check = () =>
      setHasInjected(typeof window !== "undefined" && !!(window as Window & { ethereum?: unknown }).ethereum);
    check();
    const t = setTimeout(check, 400);
    return () => clearTimeout(t);
  }, [open]);

  // Auto-close once wagmi confirms the connection.
  useEffect(() => {
    if (open && isConnected) {
      setPendingName(null);
      onOpenChange(false);
    }
  }, [isConnected, open, onOpenChange]);

  const findConnector = (re: RegExp): Connector | undefined =>
    connectors.find((c) => re.test(c.id) || re.test(c.name));

  const items = useMemo(
    () => WALLETS.map((w) => ({ ...w, connector: findConnector(w.match) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connectors]
  );

  const connectTo = async (name: string, connector?: Connector) => {
    if (!connector) {
      toast.error(`${name} not available`, { description: "Try WalletConnect below." });
      return;
    }
    try {
      setPendingName(name);
      toast.loading(`Opening ${name}…`, {
        id: "wc",
        description: "Approve the connection in your wallet app.",
        duration: 8000,
      });
      await connectAsync({ connector });
      toast.success(`${name} connected`, { id: "wc" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Connection failed";
      toast.error(`${name}: ${msg}`, { id: "wc" });
    } finally {
      setPendingName(null);
    }
  };

  const connectInjected = () => {
    const inj = findConnector(/injected/i);
    void connectTo("Detected Wallet", inj);
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
              ? "Wallet detected in this browser. Tap to connect."
              : "Pick your wallet — it will open and ask you to approve."}
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
              {pendingName === "Detected Wallet" ? "Waiting for approval…" : "Connect Detected Wallet"}
            </Button>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
              Choose a wallet
            </p>
            <div className="space-y-2">
              {items.map((w) => {
                const busy = pendingName === w.name;
                return (
                  <button
                    key={w.name}
                    onClick={() => connectTo(w.name, w.connector)}
                    disabled={isPending || !w.connector}
                    className="w-full flex items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border hover:bg-muted/60 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{w.icon}</span>
                      <div className="text-left">
                        <p className="font-semibold text-foreground">{w.name}</p>
                        <p className="text-[11px] text-muted-foreground">{w.note}</p>
                      </div>
                    </div>
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {w.connector ? "Connect" : "N/A"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 border-t border-border/50">
            <button
              onClick={useWalletConnectFallback}
              className="w-full flex items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border hover:bg-muted/60 active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-3">
                <QrCode className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <p className="font-semibold text-foreground">More wallets / QR</p>
                  <p className="text-xs text-muted-foreground">WalletConnect v2 modal</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileWalletSheet;
