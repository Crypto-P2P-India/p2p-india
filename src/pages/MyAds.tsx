import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Wallet, Package, Loader2, Plus, CheckCircle2, XCircle, ExternalLink, Clock, AlertTriangle, MessageSquare, Copy } from "lucide-react";
import { cleanupDealAttachments } from "@/lib/dealCleanup";
import Navbar from "@/components/Navbar";
import DealOutcome from "@/components/DealOutcome";
import DealTimeline from "@/components/DealTimeline";
import { useContractAds } from "@/hooks/useContractAds";
import { useContractDeals } from "@/hooks/useContractDeals";
import { useDealTxHashes } from "@/hooks/useDealTxHashes";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { P2P_CONTRACT_ADDRESS } from "@/config/wagmi";
import { P2P_ESCROW_ABI } from "@/config/abi";
import { toast } from "sonner";
import { playSuccessChime, playAlertChime } from "@/lib/sounds";
import { parsePaymentInfo } from "@/lib/parsePaymentInfo";
import CreateOrderModal from "@/components/CreateOrderModal";
import CreateBuyAdModal from "@/components/CreateBuyAdModal";
import MyBuyAdsList from "@/components/MyBuyAdsList";
import BuyDealsSection from "@/components/BuyDealsSection";
import ChatPanel from "@/components/ChatPanel";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";

const shortAddr = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;
const formatTime = (seconds: number) => {
  if (seconds <= 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const BSCSCAN_CONTRACT = `https://bscscan.com/address/${P2P_CONTRACT_ADDRESS}`;

const formatTimeout = (seconds: number) => {
  if (seconds >= 3600) return `${seconds / 3600}h`;
  return `${seconds / 60} min`;
};

const STATUS_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "Live", color: "text-buy" },
  1: { label: "In Deal", color: "text-primary" },
  2: { label: "Completed", color: "text-muted-foreground" },
  3: { label: "Cancelled", color: "text-sell" },
  4: { label: "Expired", color: "text-muted-foreground" },
};

const MyAds = () => {
  const { address, isConnected } = useAccount();
  const { ads, isLoading, refetch: refetchAds } = useContractAds();
  const { deals, refetch: refetchDeals } = useContractDeals();
  const activeDealIds = deals.filter(d => d.status === 0 || d.status === 1 || d.status === 4).map(d => d.dealId);
  const unreadCounts = useUnreadCounts(activeDealIds, address || "");
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateBuy, setShowCreateBuy] = useState(false);
  const [pendingAdId, setPendingAdId] = useState<number | null>(null);
  const [chatDealId, setChatDealId] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [pendingReleaseDealId, setPendingReleaseDealId] = useState<number | null>(null);
  const [pendingCancelDealId, setPendingCancelDealId] = useState<number | null>(null);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  // Cancel ad
  const { writeContract: cancelAd, data: cancelHash, isPending: cancelPending } = useWriteContract();
  const { isSuccess: cancelConfirmed } = useWaitForTransactionReceipt({ hash: cancelHash });

  // (Expired ad concept removed — SellEscrow contract has no time-based ad expiry.)

  // Seller confirm receipt
  const { writeContract: sellerConfirm, data: sellerHash, isPending: sellerPending } = useWriteContract();
  const { isSuccess: sellerDone } = useWaitForTransactionReceipt({ hash: sellerHash });

  // Raise dispute
  const { writeContract: raiseDispute, data: disputeHash, isPending: disputePending } = useWriteContract();
  const { isSuccess: disputeDone } = useWaitForTransactionReceipt({ hash: disputeHash });

  // Cancel timed out deal
  const { writeContract: cancelDeal, data: cancelDealHash, isPending: cancelDealPending } = useWriteContract();
  const { isSuccess: cancelDealDone } = useWaitForTransactionReceipt({ hash: cancelDealHash });

  // Seller propose extension
  const { writeContract: proposeExt, data: proposeHash, isPending: proposePending } = useWriteContract();
  const { isSuccess: proposeDone } = useWaitForTransactionReceipt({ hash: proposeHash });

  // Seller cancel extension proposal
  const { writeContract: cancelProposal, data: cancelPropHash, isPending: cancelPropPending } = useWriteContract();
  const { isSuccess: cancelPropDone } = useWaitForTransactionReceipt({ hash: cancelPropHash });

  useEffect(() => { if (cancelConfirmed) { toast.success("Ad cancelled. Funds returned."); setPendingAdId(null); refetchAds(); refetchDeals(); } }, [cancelConfirmed]);

  useEffect(() => {
    if (sellerDone) {
      toast.success("Tokens released! Trade completed.");
      playSuccessChime();
      refetchAds();
      refetchDeals();
      if (pendingReleaseDealId) {
        cleanupDealAttachments(pendingReleaseDealId);
        setPendingReleaseDealId(null);
      }
    }
  }, [sellerDone]);
  useEffect(() => { if (disputeDone) { toast.info("Dispute raised. Admin will review."); playAlertChime(); refetchAds(); refetchDeals(); } }, [disputeDone]);
  useEffect(() => {
    if (cancelDealDone) {
      toast.success("Deal cancelled. Funds returned to your wallet.");
      playAlertChime();
      refetchAds();
      refetchDeals();
      if (pendingCancelDealId) {
        cleanupDealAttachments(pendingCancelDealId);
        setPendingCancelDealId(null);
      }
    }
  }, [cancelDealDone]);
  useEffect(() => { if (proposeDone) { toast.success("Extension proposed. Buyer can accept."); refetchDeals(); } }, [proposeDone]);
  useEffect(() => { if (cancelPropDone) { toast.success("Extension proposal withdrawn."); refetchDeals(); } }, [cancelPropDone]);

  const myAds = address
    ? ads.filter((ad) => ad.seller.toLowerCase() === address.toLowerCase())
    : [];

  const myAdIds = myAds.map(a => a.adId);
  const relatedDealIds = deals.filter(d => myAdIds.includes(d.adId)).map(d => d.dealId);
  const dealTxMap = useDealTxHashes(relatedDealIds);

  const sortedAds = [...myAds].sort((a, b) => b.adId - a.adId);
  const liveAds = sortedAds.filter((a) => a.status === 0 || a.status === 1);
  const cancelledAds = sortedAds.filter((a) => a.status === 3 || a.status === 4);
  const completedAds = sortedAds.filter((a) => a.status === 2);

  const [adTab, setAdTab] = useState<"live" | "cancelled" | "completed" | "history">("live");
  const [buyTab, setBuyTab] = useState<"live" | "cancelled" | "completed" | "history">("live");
  const liveCount = liveAds.length;
  const cancelledCount = cancelledAds.length;
  const completedCount = completedAds.length;
  const historyCount = sortedAds.length;


  const isProcessing = cancelPending || sellerPending || disputePending || cancelDealPending || proposePending || cancelPropPending;

  const handleCopy = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground" style={{ lineHeight: "1.1" }}>My Ads</h1>
          {isConnected && (
            <div className="flex gap-2">
              <Button onClick={() => setShowCreateBuy(true)} variant="buy" className="gap-2 shrink-0">
                <Plus className="h-4 w-4" /> Buy Ad
              </Button>
              <Button onClick={() => setShowCreate(true)} variant="sell" className="gap-2 shrink-0">
                <Plus className="h-4 w-4" /> Sell Ad
              </Button>
            </div>
          )}
        </div>

        {/* Buy Ads section (you want USDT, pay INR) */}
        {isConnected && (
          <section className="mb-8">
            <h2 className="text-base font-semibold text-foreground mb-3">Your Buy Ads</h2>
            {/* Sub-tabs for buy section */}
            <div className="flex gap-1 mb-4 border-b border-border overflow-x-auto">
              {(["live","cancelled","completed","history"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setBuyTab(t)}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors relative whitespace-nowrap capitalize ${buyTab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t}
                  {buyTab === t && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
                </button>
              ))}
            </div>
            <div className="space-y-4">
              <MyBuyAdsList filter={buyTab} />
              <div>
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Deals on your buy ads</h3>
                <BuyDealsSection role="buyer" filter={buyTab} />
              </div>
            </div>
          </section>
        )}


        {isConnected && (
          <h2 className="text-base font-semibold text-foreground mb-3">Your Sell Ads</h2>
        )}

        {!isConnected ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16 text-center animate-fade-up">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Wallet className="h-8 w-8 text-primary" />
            </div>
            <p className="text-foreground font-semibold mb-1">Connect your wallet</p>
            <p className="text-muted-foreground text-sm mb-4">Connect to manage your ads.</p>
            <ConnectButton />
          </div>
        ) : isLoading ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground text-sm animate-pulse">
            Loading ads from contract…
          </div>
        ) : myAds.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16 text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm mb-3">You haven't created any ads yet.</p>
            <Button onClick={() => setShowCreate(true)} variant="outline" size="sm">
              Create your first ad
            </Button>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
              <button
                onClick={() => setAdTab("live")}
                className={`px-4 py-2.5 text-sm font-medium transition-colors relative whitespace-nowrap ${adTab === "live" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Live
                {liveCount > 0 && <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs tabular-nums ${adTab === "live" ? "bg-primary/15 text-primary" : "bg-surface-3 text-muted-foreground"}`}>{liveCount}</span>}
                {adTab === "live" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
              </button>
              <button
                onClick={() => setAdTab("expired")}
                className={`px-4 py-2.5 text-sm font-medium transition-colors relative whitespace-nowrap ${adTab === "expired" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Expired / Refund
                {expiredCount > 0 && <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs tabular-nums ${adTab === "expired" ? "bg-sell/15 text-sell" : "bg-sell/15 text-sell"}`}>{expiredCount}</span>}
                {adTab === "expired" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
              </button>
              <button
                onClick={() => setAdTab("history")}
                className={`px-4 py-2.5 text-sm font-medium transition-colors relative whitespace-nowrap ${adTab === "history" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                History
                {historyCount > 0 && <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs tabular-nums ${adTab === "history" ? "bg-primary/15 text-primary" : "bg-surface-3 text-muted-foreground"}`}>{historyCount}</span>}
                {adTab === "history" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
              </button>
            </div>

            {(() => {
              const currentAds = adTab === "live" ? liveAds : adTab === "expired" ? expiredAds : historyAds;
              if (currentAds.length === 0) {
                return (
                  <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground text-sm">
                    {adTab === "live"
                      ? "No live ads. Check History tab."
                      : adTab === "expired"
                      ? "No expired ads with unclaimed funds. 🎉"
                      : "No completed or cancelled ads yet."}
                  </div>
                );
              }
              return (
                <div className="space-y-3">
                  {currentAds.map((ad, i) => {
                    const st = STATUS_LABELS[ad.status] || STATUS_LABELS[0];
                    const isLive = ad.status === 0;
                    const statusLabel = st.label;
                    const statusColorClass = st.color;
                    const relatedDeal = deals.find((d) => d.adId === ad.adId && (d.status === 0 || d.status === 1 || d.status === 4 || d.status === 5));
                    const completedDeal = deals.find((d) => d.adId === ad.adId);
                    const dealTimeLeft = relatedDeal ? relatedDeal.deadline - now : 0;
                    const isDealTimedOut = relatedDeal && dealTimeLeft <= 0 && (relatedDeal.status === 0 || relatedDeal.status === 1);
                    const showChat = relatedDeal && chatDealId === relatedDeal.dealId;

                    return (
                      <div
                        key={ad.adId}
                        className="rounded-lg border border-border bg-card overflow-hidden transition-all hover:border-primary/30 animate-fade-up"
                        style={{ animationDelay: `${i * 60}ms` }}
                      >
                        <div className="p-4 sm:p-5">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-sm ${isLive ? "bg-buy/10 text-buy" : ad.status === 1 ? "bg-primary/10 text-primary" : "bg-surface-3 text-muted-foreground"}`}>
                                #{ad.adId}
                              </div>
                              <div>
                                <div>
                                  <span className="font-medium text-foreground">{ad.tokenAmount} {ad.tokenSymbol}</span>
                                  {parseFloat(ad.totalAmount) > parseFloat(ad.tokenAmount) && (
                                    <span className="text-muted-foreground text-xs ml-1.5">of {ad.totalAmount}</span>
                                  )}
                                  <span className="text-muted-foreground text-sm ml-2">@ ₹{ad.pricePerToken}</span>
                                </div>
                                {parseFloat(ad.lockedAmount) > 0 && (
                                  <span className="inline-flex items-center gap-1 mt-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                    🔒 {ad.lockedAmount} {ad.tokenSymbol} locked in deal
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className={`text-xs font-semibold ${statusColorClass}`}>
                                {statusLabel}
                              </span>
                              {relatedDeal && (relatedDeal.status === 0 || relatedDeal.status === 1) && dealTimeLeft > 0 && (
                                <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-mono ${dealTimeLeft < 120 ? "bg-sell/10 text-sell" : "bg-primary/10 text-primary"}`}>
                                  <Clock className="h-3 w-3" />
                                  {relatedDeal.status === 1 ? "Confirm" : "Pay"}: {formatTime(dealTimeLeft)}
                                </span>
                              )}
                              {isDealTimedOut && (
                                <span className="flex items-center gap-1 rounded-full bg-sell/10 px-2.5 py-1 text-xs font-semibold text-sell">
                                  <AlertTriangle className="h-3 w-3" />
                                  {relatedDeal?.status === 1 ? "Confirm Expired" : "Pay Expired"}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Timer progress bar for active deals */}
                          {relatedDeal && (relatedDeal.status === 0 || relatedDeal.status === 1) && dealTimeLeft > 0 && (() => {
                            const fullWindow = relatedDeal.status === 1 ? 1800 : (relatedDeal.payWindow + relatedDeal.payDeadlineOffset);
                            return (
                              <div className="mt-3">
                                <div className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-1000 ${dealTimeLeft < 120 ? "bg-sell" : "bg-primary"}`}
                                    style={{ width: `${Math.max(0, Math.min(100, (dealTimeLeft / fullWindow) * 100))}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })()}

                          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground text-xs">Total INR</span>
                              <p className="text-foreground font-medium tabular-nums">₹{ad.inrTotal}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">Deal Timeout</span>
                              <p className="text-foreground text-xs">{formatTimeout(ad.dealTimeout)}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">Min Fill</span>
                              <p className="text-foreground text-xs">{parseFloat(ad.minFillAmount).toFixed(4)} {ad.tokenSymbol}</p>
                            </div>
                            {(() => {
                              const parsed = parsePaymentInfo(ad.paymentInfo);
                              return (
                                <div className="col-span-2 sm:col-span-4 mt-1">
                                  <span className="text-muted-foreground text-xs">Payment</span>
                                  <div className="mt-1 rounded-md bg-surface-2 p-2 flex items-start justify-between gap-2">
                                    <div className="text-xs text-foreground space-y-0.5">
                                      {parsed.name && <p><span className="text-muted-foreground">Name:</span> {parsed.name}</p>}
                                      {parsed.method && <p><span className="text-muted-foreground">Method:</span> {parsed.method}</p>}
                                      {parsed.fields.map((f, i) => (
                                        <p key={i}><span className="text-muted-foreground">{f.label}:</span> <span className="font-mono">{f.value}</span></p>
                                      ))}
                                    </div>
                                    <button
                                      onClick={() => handleCopy(parsed.copyableDetail, ad.adId + 10000)}
                                      className="shrink-0 text-primary hover:text-primary/80 mt-0.5"
                                      title="Copy payment detail"
                                    >
                                      {copied === ad.adId + 10000 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>


                          {/* Active deal management */}
                          {relatedDeal && (
                            <div className="mt-3 space-y-3">
                              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-primary shrink-0" />
                                    <span className="text-sm font-semibold text-primary">Deal #{relatedDeal.dealId} In Progress</span>
                                  </div>
                                  {(() => { const txh = dealTxMap[relatedDeal.dealId]?.created; return (
                                    <a href={txh ? `https://bscscan.com/tx/${txh}` : `https://bscscan.com/address/${P2P_CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                                      <ExternalLink className="h-3 w-3" /> {txh ? `tx ${txh.slice(0, 10)}…` : "BscScan"}
                                    </a>
                                  ); })()}
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                  <div>
                                    <span className="text-muted-foreground">Buyer</span>
                                    <p className="font-mono text-foreground">{shortAddr(relatedDeal.buyer)}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">INR Amount</span>
                                    <p className="text-foreground font-medium tabular-nums">₹{relatedDeal.inrAmount}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Buyer Confirmed</span>
                                    <p className={relatedDeal.buyerConfirmed ? "text-buy font-medium" : "text-muted-foreground"}>
                                      {relatedDeal.buyerConfirmed ? "✓ Yes" : "✗ No"}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Seller Confirmed</span>
                                    <p className={relatedDeal.sellerConfirmed ? "text-buy font-medium" : "text-muted-foreground"}>
                                      {relatedDeal.sellerConfirmed ? "✓ Yes" : "✗ No"}
                                    </p>
                                  </div>
                                </div>

                                {relatedDeal.buyerConfirmed && (
                                  <div className="rounded-md bg-buy/10 border border-buy/20 p-2 text-xs text-buy font-medium">
                                    💰 Buyer has confirmed payment — check your bank/UPI and release tokens if received.
                                  </div>
                                )}

                                {isDealTimedOut && !relatedDeal.buyerConfirmed && (
                                  <div className="rounded-md bg-sell/10 border border-sell/20 p-2 text-xs text-sell font-medium">
                                    ⏰ Deal expired — buyer didn't pay. Cancel to get your {ad.tokenSymbol} back.
                                  </div>
                                )}
                                {isDealTimedOut && relatedDeal.buyerConfirmed && !relatedDeal.sellerConfirmed && (
                                  <div className="rounded-md bg-primary/10 border border-primary/20 p-2 text-xs text-primary font-medium">
                                    ⏰ Deal timer expired but buyer confirmed payment. Verify payment and release, or raise a dispute.
                                  </div>
                                )}
                              </div>

                              {/* Seller deal actions */}
                              <div className="flex flex-wrap gap-2">
                                {/* Cancel only if timed out AND buyer hasn't confirmed */}
                                {isDealTimedOut && !relatedDeal.buyerConfirmed && (
                                  <Button variant="sell" size="sm" disabled={isProcessing} onClick={() => {
                                    setPendingCancelDealId(relatedDeal.dealId);
                                    cancelDeal({ address: P2P_CONTRACT_ADDRESS, abi: P2P_ESCROW_ABI, functionName: "sellerReclaimExpired", args: [BigInt(relatedDeal.dealId)] } as any);
                                  }}>
                                    {cancelDealPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                                    Cancel &amp; Reclaim Funds
                                  </Button>
                                )}

                                {/* Release button when buyer confirmed */}
                                {relatedDeal.buyerConfirmed && !relatedDeal.sellerConfirmed && (
                                  <Button variant="buy" size="sm" disabled={isProcessing} onClick={() => {
                                    setPendingReleaseDealId(relatedDeal.dealId);
                                    sellerConfirm({ address: P2P_CONTRACT_ADDRESS, abi: P2P_ESCROW_ABI, functionName: "confirmReceived", args: [BigInt(relatedDeal.dealId)] } as any);
                                  }}>
                                    {sellerPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                                    I Received ₹{relatedDeal.inrAmount} — Release
                                  </Button>
                                )}

                                {/* Dispute only after timeout when one confirmed but not the other */}
                                {isDealTimedOut && (relatedDeal.buyerConfirmed !== relatedDeal.sellerConfirmed) && (
                                  <Button variant="outline" size="sm" className="text-sell border-sell/30" disabled={isProcessing} onClick={() => {
                                    raiseDispute({ address: P2P_CONTRACT_ADDRESS, abi: P2P_ESCROW_ABI, functionName: "raiseDispute", args: [BigInt(relatedDeal.dealId)] } as any);
                                  }}>
                                    {disputePending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                                    Dispute
                                  </Button>
                                )}
                                {/* Seller propose extension — when buyer hasn't paid, deal not timed out, no existing proposal */}
                                {relatedDeal.status === 0 && !relatedDeal.buyerConfirmed && !isDealTimedOut && !relatedDeal.sellerExtensionUsed && relatedDeal.sellerProposedExtra === 0 && (
                                  <>
                                    <Button variant="outline" size="sm" disabled={isProcessing} onClick={() => proposeExt({ address: P2P_CONTRACT_ADDRESS, abi: P2P_ESCROW_ABI, functionName: "sellerProposeExtension", args: [BigInt(relatedDeal.dealId), 15 * 60] } as any)}>
                                      {proposePending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                                      Offer +15m
                                    </Button>
                                    <Button variant="outline" size="sm" disabled={isProcessing} onClick={() => proposeExt({ address: P2P_CONTRACT_ADDRESS, abi: P2P_ESCROW_ABI, functionName: "sellerProposeExtension", args: [BigInt(relatedDeal.dealId), 30 * 60] } as any)}>
                                      <Clock className="h-3 w-3 mr-1" />
                                      Offer +30m
                                    </Button>
                                  </>
                                )}

                                {/* Cancel pending extension proposal */}
                                {relatedDeal.sellerProposedExtra > 0 && !relatedDeal.sellerExtensionUsed && (
                                  <Button variant="outline" size="sm" disabled={isProcessing} onClick={() => cancelProposal({ address: P2P_CONTRACT_ADDRESS, abi: P2P_ESCROW_ABI, functionName: "sellerCancelExtensionProposal", args: [BigInt(relatedDeal.dealId)] } as any)}>
                                    {cancelPropPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                                    Withdraw +{Math.round(relatedDeal.sellerProposedExtra / 60)}m offer
                                  </Button>
                                )}

                                <Button variant="ghost" size="sm" className="text-muted-foreground ml-auto relative" onClick={() => setChatDealId(showChat ? null : relatedDeal.dealId)}>
                                  <MessageSquare className="h-3 w-3 mr-1" />
                                  {showChat ? "Hide Chat" : "Chat"}
                                  {!showChat && (unreadCounts[relatedDeal.dealId] || 0) > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sell px-1 text-[10px] font-bold text-white">
                                      {unreadCounts[relatedDeal.dealId]}
                                    </span>
                                  )}
                                </Button>
                              </div>

                              {/* Pending proposal banner */}
                              {relatedDeal.sellerProposedExtra > 0 && !relatedDeal.sellerExtensionUsed && (
                                <div className="rounded-md bg-primary/10 border border-primary/20 p-2 text-xs text-primary">
                                  ⏳ Waiting for buyer to accept your +{Math.round(relatedDeal.sellerProposedExtra / 60)}m extension.
                                </div>
                              )}
                            </div>
                          )}

                          {/* Disputed deal on ad */}
                          {relatedDeal && relatedDeal.status === 4 && (
                            <div className="mt-3 rounded-lg border border-sell/20 bg-sell/5 p-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-sell shrink-0" />
                                <span className="text-sm font-semibold text-sell">Deal #{relatedDeal.dealId} Disputed</span>
                              </div>
                              <p className="text-xs text-muted-foreground">Admin is reviewing. Funds are locked in escrow.</p>
                              <Button variant="ghost" size="sm" className="text-muted-foreground relative" onClick={() => setChatDealId(showChat ? null : relatedDeal.dealId)}>
                                <MessageSquare className="h-3 w-3 mr-1" />
                                {showChat ? "Hide Chat" : "Chat"}
                                {!showChat && (unreadCounts[relatedDeal.dealId] || 0) > 0 && (
                                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sell px-1 text-[10px] font-bold text-white">
                                    {unreadCounts[relatedDeal.dealId]}
                                  </span>
                                )}
                              </Button>
                            </div>
                          )}

                          {/* Outcome for completed/cancelled ads */}
                          {(ad.status === 2 || ad.status === 3) && (() => {
                            // All deals that ever ran on this ad
                            const adDeals = deals.filter((d) => d.adId === ad.adId);
                            const completedDeals = adDeals.filter((d) => d.status === 2 || d.status === 5);
                            const resolvedDeal = adDeals.find((d) => d.status === 5);

                            const totalSoldTokens = completedDeals.reduce((s, d) => s + parseFloat(d.tokenAmount || "0"), 0);
                            const totalSoldInr = completedDeals.reduce((s, d) => s + parseFloat(d.inrAmount || "0"), 0);
                            const totalAdTokens = parseFloat(ad.totalAmount || "0");
                            const cancelledTokens = Math.max(0, totalAdTokens - totalSoldTokens);
                            const cancelledInr = cancelledTokens * parseFloat(ad.pricePerToken || "0");

                            const isAdCompleted = ad.status === 2;
                            const hadPartial = !isAdCompleted && totalSoldTokens > 0;

                            const headerLabel = resolvedDeal
                              ? "Dispute Resolved by Admin"
                              : isAdCompleted
                              ? "Ad Fully Sold"
                              : hadPartial
                              ? "Ad Closed — Partially Sold"
                              : "Ad Cancelled";

                            const headerColor = isAdCompleted || hadPartial ? "text-buy" : "text-muted-foreground";
                            const HeaderIcon = isAdCompleted || hadPartial ? CheckCircle2 : XCircle;
                            const borderClass = (isAdCompleted || hadPartial) ? "border-buy/20 bg-buy/5" : "border-border bg-surface-1";

                            return (
                              <div className={`mt-3 rounded-lg border p-3 space-y-3 ${borderClass}`}>
                                <div className="flex items-center gap-2">
                                  <HeaderIcon className={`h-4 w-4 shrink-0 ${headerColor}`} />
                                  <span className={`text-sm font-semibold ${headerColor}`}>{headerLabel}</span>
                                </div>

                                {/* Summary line */}
                                <div className="text-xs text-muted-foreground space-y-1">
                                  {totalSoldTokens > 0 && (
                                    <p>
                                      ✅ Sold <span className="font-medium text-foreground">{totalSoldTokens.toFixed(4)} {ad.tokenSymbol}</span>
                                      {" "}for <span className="font-medium text-foreground">₹{totalSoldInr.toFixed(2)}</span>
                                      {" "}across {completedDeals.length} deal{completedDeals.length > 1 ? "s" : ""}
                                    </p>
                                  )}
                                  {cancelledTokens > 0 && !isAdCompleted && (
                                    <p>
                                      ↩️ Returned <span className="font-medium text-foreground">{cancelledTokens.toFixed(4)} {ad.tokenSymbol}</span>
                                      {" "}{cancelledInr > 0 && <>(₹{cancelledInr.toFixed(2)})</>} to your wallet
                                    </p>
                                  )}
                                  {totalSoldTokens === 0 && !isAdCompleted && (
                                    <p>You cancelled this ad. <span className="font-medium text-foreground">{ad.totalAmount} {ad.tokenSymbol}</span> returned to your wallet.</p>
                                  )}
                                </div>

                                {/* Per-deal TX list */}
                                {completedDeals.length > 0 && (
                                  <div className="space-y-1.5 pt-1 border-t border-border/40">
                                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Completed Trades</p>
                                    {completedDeals.map((cd) => {
                                      const txh = dealTxMap[cd.dealId]?.completed || dealTxMap[cd.dealId]?.resolved || dealTxMap[cd.dealId]?.created;
                                      return (
                                        <div key={cd.dealId} className="flex items-center justify-between gap-2 text-xs">
                                          <span className="text-muted-foreground">
                                            Deal #{cd.dealId} · <span className="text-foreground font-medium">{cd.tokenAmount} {cd.tokenSymbol}</span> · ₹{cd.inrAmount}
                                          </span>
                                          {txh ? (
                                            <a
                                              href={`https://bscscan.com/tx/${txh}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 text-primary hover:text-primary/80 shrink-0"
                                            >
                                              <ExternalLink className="h-3 w-3" />
                                              {txh.slice(0, 8)}…
                                            </a>
                                          ) : (
                                            <span className="text-muted-foreground/60 shrink-0">tx pending…</span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Ad-level cancel/contract link */}
                                <a
                                  href={BSCSCAN_CONTRACT}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  {cancelledTokens > 0 && !isAdCompleted ? "View contract on BscScan" : "View on BscScan"}
                                </a>
                              </div>
                            );
                          })()}

                          {/* Timeline for the most recent related deal */}
                          {(() => {
                            const adDeals = deals.filter((d) => d.adId === ad.adId);
                            const latestDeal = adDeals.sort((a, b) => b.dealId - a.dealId)[0];
                            const events = latestDeal ? dealTxMap[latestDeal.dealId]?.events : undefined;
                            return events && events.length > 0 ? <DealTimeline events={events} /> : null;
                          })()}

                          {/* Actions for live ads */}
                          {ad.status === 0 && (() => {
                            const hasLocked = parseFloat(ad.lockedAmount) > 0;
                            return (
                              <div className="mt-3 space-y-2">
                                {hasLocked ? (
                                  <p className="text-xs text-muted-foreground">
                                    🔒 Cannot cancel while <span className="font-medium text-foreground">{ad.lockedAmount} {ad.tokenSymbol}</span> is locked in an active deal. Finish or resolve the deal first.
                                  </p>
                                ) : (
                                  <p className="text-xs text-muted-foreground">
                                    💡 Cancel to return <span className="font-medium text-foreground">{ad.tokenAmount} {ad.tokenSymbol}</span> to your wallet.
                                  </p>
                                )}
                                <div className="flex gap-2">
                                  <Button variant="sell" size="sm" onClick={() => { setPendingAdId(ad.adId); cancelAd({ address: P2P_CONTRACT_ADDRESS, abi: P2P_ESCROW_ABI, functionName: "cancelAd", args: [BigInt(ad.adId)] } as any); }} disabled={hasLocked || (cancelPending && pendingAdId === ad.adId)}>
                                    {cancelPending && pendingAdId === ad.adId ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                                    Cancel Ad &amp; Get Funds
                                  </Button>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Actions for expired ads with unclaimed funds */}
                          {ad.status === 4 && parseFloat(ad.tokenAmount) > 0 && (() => {
                            const hasLocked = parseFloat(ad.lockedAmount) > 0;
                            return (
                              <div className="mt-3 space-y-2 rounded-md border border-sell/30 bg-sell/5 p-3">
                                <p className="text-xs text-foreground">
                                  ⏰ This ad expired with <span className="font-medium">{ad.tokenAmount} {ad.tokenSymbol}</span> unsold.
                                  {hasLocked
                                    ? " Some funds are still locked in an active deal — resolve it first to claim the rest."
                                    : " Claim your refund to return the funds to your wallet."}
                                </p>
                                <div className="flex gap-2">
                                  <Button variant="sell" size="sm" onClick={() => { setPendingAdId(ad.adId); cancelAd({ address: P2P_CONTRACT_ADDRESS, abi: P2P_ESCROW_ABI, functionName: "cancelAd", args: [BigInt(ad.adId)] } as any); }} disabled={hasLocked || (cancelPending && pendingAdId === ad.adId)}>
                                    {cancelPending && pendingAdId === ad.adId ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                    Claim Refund
                                  </Button>
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Chat panel */}
                        {showChat && relatedDeal && (
                          <div className="border-t border-border h-72">
                            <ChatPanel dealId={relatedDeal.dealId} userAddress={address!} partnerAddress={relatedDeal.buyer} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </>
        )}
      </main>

      <CreateOrderModal open={showCreate} onClose={() => setShowCreate(false)} />
      <CreateBuyAdModal open={showCreateBuy} onClose={() => setShowCreateBuy(false)} />
    </div>
  );
};

export default MyAds;
