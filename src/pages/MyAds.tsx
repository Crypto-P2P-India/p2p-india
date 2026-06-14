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
  const [pendingAdId, setPendingAdId] = useState<number | null>(null);
  const [chatDealId, setChatDealId] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
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

  useEffect(() => { if (sellerDone) { toast.success("Tokens released! Trade completed."); playSuccessChime(); refetchAds(); refetchDeals(); } }, [sellerDone]);
  useEffect(() => { if (disputeDone) { toast.info("Dispute raised. Admin will review."); playAlertChime(); refetchAds(); refetchDeals(); } }, [disputeDone]);
  useEffect(() => { if (cancelDealDone) { toast.success("Deal cancelled. Funds returned to your wallet."); playAlertChime(); refetchAds(); refetchDeals(); } }, [cancelDealDone]);
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
  const historyAds = sortedAds.filter((a) => a.status === 2 || a.status === 3);

  const [adTab, setAdTab] = useState<"live" | "history">("live");
  const liveCount = liveAds.length;
  const historyCount = historyAds.length;

  const isProcessing = cancelPending || sellerPending || disputePending || cancelDealPending;

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
            <Button onClick={() => setShowCreate(true)} className="gap-2 shrink-0">
              <Plus className="h-4 w-4" />
              Post Ad
            </Button>
          )}
        </div>

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
            <div className="flex gap-1 mb-6 border-b border-border">
              <button
                onClick={() => setAdTab("live")}
                className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${adTab === "live" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Live
                {liveCount > 0 && <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs tabular-nums ${adTab === "live" ? "bg-primary/15 text-primary" : "bg-surface-3 text-muted-foreground"}`}>{liveCount}</span>}
                {adTab === "live" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
              </button>
              <button
                onClick={() => setAdTab("history")}
                className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${adTab === "history" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                History
                {historyCount > 0 && <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs tabular-nums ${adTab === "history" ? "bg-primary/15 text-primary" : "bg-surface-3 text-muted-foreground"}`}>{historyCount}</span>}
                {adTab === "history" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
              </button>
            </div>

            {(() => {
              const currentAds = adTab === "live" ? liveAds : historyAds;
              if (currentAds.length === 0) {
                return (
                  <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground text-sm">
                    {adTab === "live" ? "No live ads. Check History tab." : "No completed or cancelled ads yet."}
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
                            const fullWindow = relatedDeal.status === 1 ? 1800 : 900;
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
                                    cancelDeal({ address: P2P_CONTRACT_ADDRESS, abi: P2P_ESCROW_ABI, functionName: "sellerReclaimExpired", args: [BigInt(relatedDeal.dealId)] } as any);
                                  }}>
                                    {cancelDealPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                                    Cancel &amp; Reclaim Funds
                                  </Button>
                                )}

                                {/* Release button when buyer confirmed */}
                                {relatedDeal.buyerConfirmed && !relatedDeal.sellerConfirmed && (
                                  <Button variant="buy" size="sm" disabled={isProcessing} onClick={() => {
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
                            // Also check if there's a resolved deal for this ad
                            const resolvedDeal = deals.find((d) => d.adId === ad.adId && d.status === 5);
                            const displayDeal = resolvedDeal || completedDeal;
                            const isAdCompleted = ad.status === 2;
                            const isResolved = !!resolvedDeal;
                            return (
                              <div className={`mt-3 rounded-lg border p-3 space-y-2 ${isAdCompleted ? "border-buy/20 bg-buy/5" : "border-border bg-surface-1"}`}>
                                <div className="flex items-center gap-2">
                                  {isAdCompleted ? <CheckCircle2 className="h-4 w-4 text-buy shrink-0" /> : <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />}
                                  <span className={`text-sm font-semibold ${isAdCompleted ? "text-buy" : "text-muted-foreground"}`}>
                                    {isResolved ? "Dispute Resolved by Admin" : isAdCompleted ? "Deal Completed" : "Ad Cancelled"}
                                  </span>
                                </div>
                                <div className="text-xs text-muted-foreground space-y-1">
                                  {isResolved && resolvedDeal ? (
                                    (() => {
                                      const recipient = dealTxMap[resolvedDeal.dealId]?.resolvedRecipient;
                                      const recipientIsBuyer = recipient?.toLowerCase() === resolvedDeal.buyer.toLowerCase();
                                      const recipientIsSeller = recipient?.toLowerCase() === resolvedDeal.seller.toLowerCase();
                                      const youReceived = recipientIsSeller; // seller is viewing MyAds
                                      return (
                                        <p>
                                          Dispute on Deal #{resolvedDeal.dealId} resolved by admin.{" "}
                                          {youReceived
                                            ? <><span className="font-medium text-buy">You received</span> {ad.tokenAmount} {ad.tokenSymbol} back.</>
                                            : recipientIsBuyer
                                            ? <>Buyer <span className="font-mono text-foreground">{shortAddr(resolvedDeal.buyer)}</span> received {ad.tokenAmount} {ad.tokenSymbol}.</>
                                            : <>Funds released from escrow.</>}
                                        </p>
                                      );
                                    })()
                                  ) : isAdCompleted && displayDeal ? (
                                    <>
                                      <p>Buyer <span className="font-mono text-foreground">{shortAddr(displayDeal.buyer)}</span> paid ₹{displayDeal.inrAmount}</p>
                                      <p>You released <span className="font-medium text-foreground">{ad.tokenAmount} {ad.tokenSymbol}</span> to buyer</p>
                                    </>
                                  ) : isAdCompleted ? (
                                    <p>Deal completed. {ad.tokenAmount} {ad.tokenSymbol} released to buyer.</p>
                                  ) : (
                                    <p>You cancelled this ad. <span className="font-medium text-foreground">{ad.tokenAmount} {ad.tokenSymbol}</span> returned to your wallet.</p>
                                  )}
                                </div>
                                {(() => { const txh = completedDeal ? (dealTxMap[completedDeal.dealId]?.completed || dealTxMap[completedDeal.dealId]?.cancelled || dealTxMap[completedDeal.dealId]?.resolved || dealTxMap[completedDeal.dealId]?.created) : undefined; return (
                                  <a href={txh ? `https://bscscan.com/tx/${txh}` : BSCSCAN_CONTRACT} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                                    <ExternalLink className="h-3 w-3" /> {txh ? `View tx ${txh.slice(0, 10)}…` : "View on BscScan"}
                                  </a>
                                ); })()}
                              </div>
                            );
                          })()}

                          {/* Timeline for deals associated with this ad */}
                          {completedDeal && dealTxMap[completedDeal.dealId]?.events?.length > 0 && (
                            <DealTimeline events={dealTxMap[completedDeal.dealId].events} />
                          )}
                          {relatedDeal && !completedDeal && dealTxMap[relatedDeal.dealId]?.events?.length > 0 && (
                            <DealTimeline events={dealTxMap[relatedDeal.dealId].events} />
                          )}

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
                        </div>

                        {/* Chat panel */}
                        {showChat && relatedDeal && (
                          <div className="border-t border-border h-72">
                            <ChatPanel dealId={relatedDeal.dealId} userAddress={address!} />
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
    </div>
  );
};

export default MyAds;
