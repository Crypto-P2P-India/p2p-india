import { useEffect, useState } from "react";
import { useAccount, useConnect } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, ExternalLink, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

type LogEntry = {
  ts: string;
  wallet: string;
  step: string;
  status: "info" | "success" | "error" | "warning";
  detail?: string;
};

type WalletTest = {
  id: string;
  name: string;
  icon: string;
  // primary scheme attempted first (custom)
  scheme: string;
  // universal HTTPS fallback
  universal: string;
};

const TESTS: WalletTest[] = [
  { id: "okx", name: "OKX Wallet", icon: "⚫", scheme: "okx://wallet/dapp/url?dappUrl=https://example.com", universal: "https://www.okx.com/download" },
  { id: "metamask", name: "MetaMask", icon: "🦊", scheme: "metamask://dapp/example.com", universal: "https://metamask.app.link/dapp/example.com" },
  { id: "trust", name: "Trust Wallet", icon: "🛡️", scheme: "trust://browser_enable", universal: "https://link.trustwallet.com/open_url?url=https://example.com" },
  { id: "bitget", name: "Bitget Wallet", icon: "🟢", scheme: "bitkeep://bkconnect", universal: "https://bkcode.vip/" },
  { id: "binance", name: "Binance Wallet", icon: "🟡", scheme: "bnc://app.binance.com/", universal: "https://app.binance.com/" },
  { id: "tokenpocket", name: "TokenPocket", icon: "🟣", scheme: "tpoutside://", universal: "https://www.tokenpocket.pro/" },
];

const WalletDebug = () => {
  const { connectors } = useConnect();
  const { isConnected, address, connector } = useAccount();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [hasEthereum, setHasEthereum] = useState(false);
  const [providerInfo, setProviderInfo] = useState<string>("none");

  useEffect(() => {
    const eth = (window as Window & { ethereum?: Record<string, unknown> }).ethereum;
    setHasEthereum(!!eth);
    if (eth) {
      const flags: string[] = [];
      if (eth.isMetaMask) flags.push("isMetaMask");
      if (eth.isOkxWallet || eth.isOKExWallet) flags.push("isOkxWallet");
      if (eth.isTrust || eth.isTrustWallet) flags.push("isTrust");
      if (eth.isBitKeep) flags.push("isBitKeep");
      if (eth.isCoinbaseWallet) flags.push("isCoinbaseWallet");
      if (eth.isBinance) flags.push("isBinance");
      setProviderInfo(flags.length ? flags.join(", ") : "unknown injected provider");
    }
  }, []);

  const log = (entry: Omit<LogEntry, "ts">) => {
    setLogs((prev) => [{ ...entry, ts: new Date().toLocaleTimeString() }, ...prev].slice(0, 50));
  };

  const testDeepLink = (w: WalletTest) => {
    log({ wallet: w.name, step: "Attempting custom scheme", status: "info", detail: w.scheme });

    const start = Date.now();
    let didHide = false;

    const onVisibilityChange = () => {
      if (document.hidden) {
        didHide = true;
        log({
          wallet: w.name,
          step: "✅ App opened",
          status: "success",
          detail: `Page hidden after ${Date.now() - start}ms — wallet app launched`,
        });
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Try custom scheme
    try {
      window.location.href = w.scheme;
    } catch (e) {
      log({ wallet: w.name, step: "Scheme threw error", status: "error", detail: String(e) });
    }

    // After 2s, if page never hid, fall back to universal link
    setTimeout(() => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (!didHide) {
        log({
          wallet: w.name,
          step: "❌ App not installed (or scheme blocked)",
          status: "warning",
          detail: `Page never hidden — opening universal link: ${w.universal}`,
        });
        window.open(w.universal, "_system");
      }
    }, 2000);
  };

  const clearLogs = () => setLogs([]);

  return (
    <div className="container max-w-2xl mx-auto p-4 pb-24">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <h1 className="text-2xl font-bold mb-1">Wallet Debug</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Test wallet deep links. If your wallet is installed, the app should open and you'll see "App opened" in the log.
        If not, you'll be sent to the download page.
      </p>

      <Card className="p-4 mb-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Injected provider</span>
          {hasEthereum ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3 w-3" /> Detected
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <XCircle className="h-3 w-3" /> None
            </Badge>
          )}
        </div>
        {hasEthereum && (
          <div className="text-xs text-muted-foreground break-all">Flags: {providerInfo}</div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Wallet connected</span>
          {isConnected ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3 w-3" /> {connector?.name}
            </Badge>
          ) : (
            <Badge variant="secondary">Not connected</Badge>
          )}
        </div>
        {address && <div className="text-xs text-muted-foreground break-all font-mono">{address}</div>}
        <div className="text-xs text-muted-foreground pt-2 border-t border-border">
          Available connectors: {connectors.map((c) => c.name).join(", ") || "none"}
        </div>
      </Card>

      <div className="space-y-2 mb-4">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Tap to test</h2>
        {TESTS.map((w) => (
          <button
            key={w.id}
            onClick={() => testDeepLink(w)}
            className="w-full flex items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border hover:bg-muted/60 active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{w.icon}</span>
              <div className="text-left">
                <p className="font-semibold">{w.name}</p>
                <p className="text-xs text-muted-foreground">Test deep link</p>
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Log</h2>
        <Button variant="ghost" size="sm" onClick={clearLogs}>Clear</Button>
      </div>

      <Card className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No events yet. Tap a wallet above to test.</p>
        ) : (
          logs.map((l, i) => (
            <div key={i} className="text-xs border-b border-border/40 pb-2 last:border-0">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{l.ts}</span>
                <span className="font-semibold">{l.wallet}</span>
                <Badge
                  variant={
                    l.status === "success" ? "default" : l.status === "error" ? "destructive" : "secondary"
                  }
                  className="text-[10px] py-0 px-1.5"
                >
                  {l.status}
                </Badge>
              </div>
              <div className="mt-1">{l.step}</div>
              {l.detail && <div className="text-muted-foreground break-all mt-0.5">{l.detail}</div>}
            </div>
          ))
        )}
      </Card>
    </div>
  );
};

export default WalletDebug;
