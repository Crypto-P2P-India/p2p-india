import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Button } from "@/components/ui/button";
import { Loader2, XCircle, Clock, Lock } from "lucide-react";
import { BUY_ESCROW_ADDRESS, BUY_ESCROW_ABI } from "@/config/buyEscrowAbi";
import { useBuyContractAds } from "@/hooks/useBuyContractAds";
import { toast } from "sonner";
import { useEffect, useState } from "react";

const fmtLeft = (ts: number) => {
  const d = Math.max(0, ts - Date.now() / 1000);
  if (d <= 0) return "Expired";
  const h = Math.floor(d / 3600), m = Math.floor((d % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const STATUS_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "Live", color: "text-buy" },
  1: { label: "Closed", color: "text-muted-foreground" },
  2: { label: "Expired", color: "text-sell" },
};

const MyBuyAdsList = () => {
  const { address } = useAccount();
  const { ads, refetch } = useBuyContractAds();
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<"cancel" | "reclaim" | null>(null);

  const { writeContract: cancel, data: hash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) {
      toast.success(pendingAction === "reclaim" ? "Refund claimed. Funds returned to your wallet." : "Buy ad cancelled.");
      setPendingId(null);
      setPendingAction(null);
      refetch();
    }
  }, [isSuccess]);

  const myAds = address ? ads.filter(a => a.buyer.toLowerCase() === address.toLowerCase()) : [];

  if (myAds.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground text-sm">
        You haven't posted any buy ads yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {myAds.sort((a, b) => b.adId - a.adId).map((ad, i) => {
        const st = STATUS_LABELS[ad.status] || STATUS_LABELS[0];
        const locked = parseFloat(ad.lockedUsdt);
        const remaining = parseFloat(ad.remainingUsdt);
        const canClaimRefund = ad.status === 2 && remaining > 0 && locked === 0;
        return (
          <div key={ad.adId} className={`rounded-lg border bg-card p-4 sm:p-5 animate-fade-up ${canClaimRefund ? "border-sell/40" : "border-border"}`} style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sell/10 text-sell font-bold text-sm">B#{ad.adId}</div>
                <div>
                  <span className="font-medium text-foreground">Want {ad.totalUsdt} USDT</span>
                  <span className="text-muted-foreground text-sm ml-2">@ ₹{ad.rateInrPerUsdt}</span>
                  {locked > 0 && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      <Lock className="h-2.5 w-2.5" /> {locked} locked
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold ${st.color}`}>{st.label}</span>
                {ad.status === 0 && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> {fmtLeft(ad.expiresAt)}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div><span className="text-muted-foreground text-xs">Remaining</span><p className="text-foreground font-medium tabular-nums">{ad.remainingUsdt}</p></div>
              <div><span className="text-muted-foreground text-xs">Min trade</span><p className="text-foreground text-xs tabular-nums">{ad.minTradeUsdt}</p></div>
              <div><span className="text-muted-foreground text-xs">Total INR</span><p className="text-foreground font-medium tabular-nums">₹{ad.inrTotal}</p></div>
            </div>

            {ad.status === 0 && locked === 0 && (
              <div className="mt-3">
                <Button
                  variant="outline" size="sm" disabled={isPending}
                  onClick={() => { setPendingId(ad.adId); setPendingAction("cancel"); cancel({ address: BUY_ESCROW_ADDRESS, abi: BUY_ESCROW_ABI, functionName: "cancelAd", args: [BigInt(ad.adId)] } as any); }}
                >
                  {isPending && pendingId === ad.adId ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                  Cancel Ad
                </Button>
              </div>
            )}

            {canClaimRefund && (
              <div className="mt-3 rounded-md border border-sell/30 bg-sell/5 p-3">
                <p className="text-xs text-foreground mb-2">
                  ⏰ This buy ad expired with {ad.remainingUsdt} USDT unfilled. Claim your refund to release the reserved funds back to your wallet.
                </p>
                <Button
                  variant="sell" size="sm" disabled={isPending}
                  onClick={() => { setPendingId(ad.adId); setPendingAction("reclaim"); cancel({ address: BUY_ESCROW_ADDRESS, abi: BUY_ESCROW_ABI, functionName: "reclaimExpired", args: [BigInt(ad.adId)] } as any); }}
                >
                  {isPending && pendingId === ad.adId ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Claim Refund
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MyBuyAdsList;
