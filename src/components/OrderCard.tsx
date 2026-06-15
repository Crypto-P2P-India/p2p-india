import { Button } from "@/components/ui/button";
import { Shield, Clock, Timer, TrendingUp, Lock } from "lucide-react";
import { useBnbPrice } from "@/hooks/useBnbPrice";
import { parsePaymentInfo } from "@/lib/parsePaymentInfo";


interface OrderCardProps {
  adId: number;
  seller: string;
  tokenSymbol: string;
  tokenAmount: string;
  totalAmount?: string;
  lockedAmount?: string;
  pricePerToken: string;
  inrTotal: string;
  dealTimeout: number;
  adExpiry: number;
  paymentInfo: string;
  onTrade: () => void;
  index: number;
}

const shortAddr = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

const formatTimeout = (seconds: number) => {
  if (seconds >= 3600) return `${seconds / 3600}h`;
  return `${seconds / 60} min`;
};

const formatTimeLeft = (expiryTimestamp: number) => {
  const now = Date.now() / 1000;
  const diff = Math.max(0, expiryTimestamp - now);
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
};

const OrderCard = ({
  seller,
  tokenSymbol,
  tokenAmount,
  totalAmount,
  lockedAmount,
  pricePerToken,
  inrTotal,
  dealTimeout,
  adExpiry,
  paymentInfo,
  onTrade,
  index,
}: OrderCardProps) => {
  const timeLeftStr = formatTimeLeft(adExpiry);
  const isBNB = tokenSymbol === "BNB";
  const lockedNum = lockedAmount ? parseFloat(lockedAmount) : 0;
  const totalNum = totalAmount ? parseFloat(totalAmount) : 0;
  const showLocked = lockedNum > 0 && totalNum > 0;
  const { bnbPrice } = useBnbPrice(isBNB);
  // For BNB ads, derive the INR/USD rate from stored pricePerToken / bnbPrice
  const inrPerUsd = isBNB && bnbPrice ? (parseFloat(pricePerToken) / bnbPrice).toFixed(2) : null;

  return (
    <div
      className="group rounded-lg border border-border bg-card p-4 sm:p-5 transition-all duration-300 hover:border-primary/30 hover:shadow-[0_0_24px_-6px_hsl(var(--primary)/0.15)] animate-fade-up active:scale-[0.99]"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Seller Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
            {seller.slice(2, 4).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground font-mono text-sm">{shortAddr(seller)}</span>
              <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
            </div>
          </div>
        </div>

        {/* Price */}
        <div className="sm:text-right">
          {isBNB && inrPerUsd ? (
            <div>
              <div className="text-lg font-bold text-foreground tabular-nums">
                ₹{inrPerUsd} <span className="text-sm font-normal text-muted-foreground">/ USD</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground sm:justify-end">
                <TrendingUp className="h-3 w-3" />
                ₹{pricePerToken}/BNB
              </div>
            </div>
          ) : (
            <div className="text-lg font-bold text-foreground tabular-nums">
              ₹{pricePerToken} <span className="text-sm font-normal text-muted-foreground">INR</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <span className="text-muted-foreground text-xs">Available</span>
          <p className="text-foreground font-medium tabular-nums">{tokenAmount} {tokenSymbol}</p>
          {showLocked && (
            <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
              {lockedNum} locked · {totalNum} total
            </p>
          )}
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Total (INR)</span>
          <p className="text-foreground font-medium tabular-nums">₹{inrTotal}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Payment</span>
          <p className="text-foreground text-xs mt-1 flex items-center gap-1 truncate">
            <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
            {parsePaymentInfo(paymentInfo).method || "Hidden"}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Ad Expires</span>
          <p className="text-foreground text-xs mt-1 flex items-center gap-1">
            <Timer className="h-3 w-3 text-muted-foreground" />
            {timeLeftStr}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>{formatTimeout(dealTimeout)} payment window</span>
        </div>
        <Button variant="buy" size="sm" onClick={onTrade} className="min-h-[44px] min-w-[80px] text-sm">
          Buy {tokenSymbol}
        </Button>
      </div>
    </div>
  );
};

export default OrderCard;
