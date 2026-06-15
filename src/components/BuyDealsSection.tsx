import { useEffect, useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Button } from "@/components/ui/button";
import { Loader2, Clock, CheckCircle2, AlertTriangle, Copy, MessageSquare, ExternalLink, X } from "lucide-react";
import { BUY_ESCROW_ADDRESS, BUY_ESCROW_ABI } from "@/config/buyEscrowAbi";
import { useBuyContractDeals, BUY_CHAT_OFFSET, type LiveBuyDeal } from "@/hooks/useBuyContractDeals";
import { useBuyContractAds } from "@/hooks/useBuyContractAds";
import { toast } from "sonner";
import { playSuccessChime, playAlertChime } from "@/lib/sounds";
import ChatPanel from "@/components/ChatPanel";

interface Props {
  /** 'seller' = show deals where I locked USDT; 'buyer' = show deals on my own buy ads */
  role: "seller" | "buyer";
}

const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const fmtTime = (s: number) => { if (s <= 0) return "00:00"; const m = Math.floor(s / 60); const r = s % 60; return `${m.toString().padStart(2,"0")}:${r.toString().padStart(2,"0")}`; };

const STATUS: Record<number, { label: string; color: string }> = {
  0: { label: "Locked — awaiting buyer payment", color: "text-primary" },
  1: { label: "Buyer marked paid — release USDT", color: "text-buy" },
  2: { label: "Completed", color: "text-buy" },
  3: { label: "Reclaimed (expired)", color: "text-sell" },
  4: { label: "Disputed", color: "text-sell" },
  5: { label: "Resolved → Buyer", color: "text-primary" },
  6: { label: "Resolved → Seller", color: "text-primary" },
};

const BuyDealsSection = ({ role }: Props) => {
  const { address } = useAccount();
  const { deals, refetch } = useBuyContractDeals();
  const { refetch: refetchAds } = useBuyContractAds();
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [chatId, setChatId] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  useEffect(() => { const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000); return () => clearInterval(t); }, []);

  // Filter
  const myDeals: LiveBuyDeal[] = address
    ? deals.filter((d) => role === "seller"
        ? d.seller.toLowerCase() === address.toLowerCase()
        : d.buyer.toLowerCase() === address.toLowerCase())
    : [];

  const { writeContract: markPaid, data: paidHash, isPending: paidPending } = useWriteContract();
  const { isSuccess: paidOk } = useWaitForTransactionReceipt({ hash: paidHash });

  const { writeContract: release, data: relHash, isPending: relPending } = useWriteContract();
  const { isSuccess: relOk } = useWaitForTransactionReceipt({ hash: relHash });

  const { writeContract: reclaim, data: rcHash, isPending: rcPending } = useWriteContract();
  const { isSuccess: rcOk } = useWaitForTransactionReceipt({ hash: rcHash });

  const { writeContract: dispute, data: dHash, isPending: dPending } = useWriteContract();
  const { isSuccess: dOk } = useWaitForTransactionReceipt({ hash: dHash });

  useEffect(() => { if (paidOk) { toast.success("Marked paid on-chain. Seller will release."); playSuccessChime(); setPendingId(null); refetch(); refetchAds(); } }, [paidOk]);
  useEffect(() => { if (relOk) { toast.success("USDT released! Trade completed."); playSuccessChime(); setPendingId(null); refetch(); refetchAds(); } }, [relOk]);
  useEffect(() => { if (rcOk) { toast.success("USDT reclaimed."); playAlertChime(); setPendingId(null); refetch(); refetchAds(); } }, [rcOk]);
  useEffect(() => { if (dOk) { toast.info("Dispute opened. Admin will review."); playAlertChime(); setPendingId(null); refetch(); } }, [dOk]);

  if (myDeals.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground text-sm">
        {role === "seller" ? "You haven't accepted any buy ads yet." : "No sellers have accepted your buy ads yet."}
      </div>
    );
  }

  const processing = paidPending || relPending || rcPending || dPending;

  const handleCopy = (text: string, id: number) => {
    navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-3">
      {myDeals.sort((a, b) => b.dealId - a.dealId).map((d, i) => {
        const st = STATUS[d.status] || STATUS[0];
        const isActive = d.status === 0 || d.status === 1;
        const timeLeft = d.paymentDeadline - now;
        const isTimedOut = timeLeft <= 0 && d.status === 0;
        const canDisputeAfterPay = d.status === 1 && d.markedPaidAt > 0 && now > d.markedPaidAt + 15 * 60;

        return (
          <div key={d.dealId} className="rounded-lg border border-border bg-card overflow-hidden animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-sm ${role === "seller" ? "bg-sell/10 text-sell" : "bg-buy/10 text-buy"}`}>
                    B#{d.dealId}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Buy Ad Deal</span>
                    <span className="text-muted-foreground text-sm ml-2">
                      {role === "seller" ? `Sold ${d.amountUsdt} USDT` : `Buying ${d.amountUsdt} USDT`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold ${st.color}`}>{st.label}</span>
                  {isActive && d.status === 0 && timeLeft > 0 && (
                    <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-mono ${timeLeft < 120 ? "bg-sell/10 text-sell" : "bg-primary/10 text-primary"}`}>
                      <Clock className="h-3 w-3" /> Pay: {fmtTime(timeLeft)}
                    </span>
                  )}
                  {isTimedOut && (
                    <span className="flex items-center gap-1 rounded-full bg-sell/10 px-2.5 py-1 text-xs font-semibold text-sell">
                      <AlertTriangle className="h-3 w-3" /> Expired
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div><span className="text-muted-foreground text-xs">INR amount</span><p className="text-foreground font-medium tabular-nums">₹{d.inrAmount}</p></div>
                <div><span className="text-muted-foreground text-xs">Rate</span><p className="text-foreground text-xs tabular-nums">₹{d.rateInrPerUsdt}/USDT</p></div>
                <div><span className="text-muted-foreground text-xs">{role === "seller" ? "Buyer" : "Seller"}</span><p className="font-mono text-foreground text-xs">{shortAddr(role === "seller" ? d.buyer : d.seller)}</p></div>
                <div><span className="text-muted-foreground text-xs">Pay window</span><p className="text-foreground text-xs">{Math.round(d.paymentWindow / 60)} min</p></div>
              </div>

              {/* Payment details visible to BOTH parties only after deal is accepted */}
              {isActive && (
                <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-foreground">
                    {role === "seller" ? "Buyer pays you at:" : "Pay seller (you receive USDT after):"}
                  </p>
                  <div className="rounded-md bg-surface-2 p-2 flex items-start justify-between gap-2">
                    <div className="text-xs text-foreground space-y-0.5 font-mono">
                      <p><span className="text-muted-foreground">Name:</span> {d.name}</p>
                      <p><span className="text-muted-foreground">Method:</span> {d.paymentMethod}</p>
                      {d.upiOrAccount && <p><span className="text-muted-foreground">UPI/A/C:</span> {d.upiOrAccount}</p>}
                      {d.bankOrIfsc && <p><span className="text-muted-foreground">Bank:</span> {d.bankOrIfsc}</p>}
                    </div>
                    <button
                      onClick={() => handleCopy(`${d.name} | ${d.paymentMethod} | ${d.upiOrAccount} | ${d.bankOrIfsc}`, d.dealId)}
                      className="shrink-0 text-primary hover:text-primary/80"
                    >
                      {copied === d.dealId ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {role === "seller"
                      ? `Wait for buyer to send ₹${d.inrAmount}, then release USDT.`
                      : `Send exactly ₹${d.inrAmount} to the buyer (yourself) — wait, you ARE the buyer. Verify the seller has accepted, then mark paid after sending INR.`}
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-3 flex flex-wrap gap-2">
                {/* Buyer markPaid */}
                {role === "buyer" && d.status === 0 && !isTimedOut && (
                  <Button variant="buy" size="sm" disabled={processing} onClick={() => { setPendingId(d.dealId); markPaid({ address: BUY_ESCROW_ADDRESS, abi: BUY_ESCROW_ABI, functionName: "markPaid", args: [BigInt(d.dealId)] } as any); }}>
                    {paidPending && pendingId === d.dealId ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    I've Sent ₹{d.inrAmount} — Mark Paid
                  </Button>
                )}
                {/* Seller release */}
                {role === "seller" && d.status === 1 && (
                  <Button variant="buy" size="sm" disabled={processing} onClick={() => { setPendingId(d.dealId); release({ address: BUY_ESCROW_ADDRESS, abi: BUY_ESCROW_ABI, functionName: "release", args: [BigInt(d.dealId)] } as any); }}>
                    {relPending && pendingId === d.dealId ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                    I Received ₹{d.inrAmount} — Release USDT
                  </Button>
                )}
                {/* Seller reclaim on timeout */}
                {role === "seller" && d.status === 0 && isTimedOut && (
                  <Button variant="sell" size="sm" disabled={processing} onClick={() => { setPendingId(d.dealId); reclaim({ address: BUY_ESCROW_ADDRESS, abi: BUY_ESCROW_ABI, functionName: "reclaimExpired", args: [BigInt(d.dealId)] } as any); }}>
                    {rcPending && pendingId === d.dealId ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                    Reclaim USDT
                  </Button>
                )}
                {/* Open dispute (buyer if seller refuses release; seller if buyer marked paid but didn't send) */}
                {canDisputeAfterPay && d.status === 1 && (
                  <Button variant="outline" size="sm" className="text-sell border-sell/30" disabled={processing} onClick={() => { setPendingId(d.dealId); dispute({ address: BUY_ESCROW_ADDRESS, abi: BUY_ESCROW_ABI, functionName: "openDispute", args: [BigInt(d.dealId)] } as any); }}>
                    {dPending && pendingId === d.dealId ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                    Open Dispute
                  </Button>
                )}
                {/* Chat */}
                <Button variant="ghost" size="sm" onClick={() => setChatId(chatId === d.dealId ? null : d.dealId)}>
                  <MessageSquare className="h-3 w-3 mr-1" /> Chat
                </Button>
                <a href={`https://bscscan.com/address/${BUY_ESCROW_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 ml-auto">
                  <ExternalLink className="h-3 w-3" /> BscScan
                </a>
              </div>
            </div>

            {chatId === d.dealId && address && (
              <div className="border-t border-border bg-surface-1 relative">
                <button onClick={() => setChatId(null)} className="absolute right-2 top-2 z-10 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
                <div className="h-96">
                  <ChatPanel dealId={BUY_CHAT_OFFSET + d.dealId} userAddress={address} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default BuyDealsSection;
