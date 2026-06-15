import { Button } from "@/components/ui/button";
import { Shield, Clock, Timer, Lock } from "lucide-react";
import type { LiveBuyAd } from "@/hooks/useBuyContractAds";

interface Props {
  ad: LiveBuyAd;
  onTrade: () => void;
  index: number;
}

const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const fmtTimeout = (s: number) => (s >= 3600 ? `${s / 3600}h` : `${s / 60} min`);
const fmtLeft = (ts: number) => {
  const d = Math.max(0, ts - Date.now() / 1000);
  if (d <= 0) return "Expired";
  const h = Math.floor(d / 3600);
  const m = Math.floor((d % 3600) / 60);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
};

const BuyAdCard = ({ ad, onTrade, index }: Props) => {
  const lockedNum = parseFloat(ad.lockedUsdt);
  const totalNum = parseFloat(ad.totalUsdt);
  const showLocked = lockedNum > 0 && totalNum > 0;

  return (
    <div
      className="group rounded-lg border border-border bg-card p-4 sm:p-5 transition-all duration-300 hover:border-sell/30 hover:shadow-[0_0_24px_-6px_hsl(var(--sell)/0.15)] animate-fade-up active:scale-[0.99]"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sell/10 text-sell font-bold text-sm">
            {ad.buyer.slice(2, 4).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground font-mono text-sm">{shortAddr(ad.buyer)}</span>
              <Shield className="h-3.5 w-3.5 text-sell shrink-0" />
              <span className="text-[10px] uppercase tracking-wide font-semibold text-sell bg-sell/10 rounded px-1.5 py-0.5">Wants USDT</span>
            </div>
          </div>
        </div>

        <div className="sm:text-right">
          <div className="text-lg font-bold text-foreground tabular-nums">
            ₹{ad.rateInrPerUsdt} <span className="text-sm font-normal text-muted-foreground">/ USDT</span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <span className="text-muted-foreground text-xs">Available</span>
          <p className="text-foreground font-medium tabular-nums">{ad.remainingUsdt} USDT</p>
          {showLocked && (
            <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
              {lockedNum} locked · {totalNum} total
            </p>
          )}
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Total (INR)</span>
          <p className="text-foreground font-medium tabular-nums">₹{ad.inrTotal}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Payment</span>
          <p className="text-foreground text-xs mt-1 flex items-center gap-1 truncate">
            <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
            {ad.paymentMethod || "Hidden"}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Ad Expires</span>
          <p className="text-foreground text-xs mt-1 flex items-center gap-1">
            <Timer className="h-3 w-3 text-muted-foreground" />
            {fmtLeft(ad.expiresAt)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>{fmtTimeout(ad.paymentWindow)} payment window</span>
        </div>
        <Button variant="sell" size="sm" onClick={onTrade} className="min-h-[44px] min-w-[80px] text-sm">
          Sell USDT
        </Button>
      </div>
    </div>
  );
};

export default BuyAdCard;
