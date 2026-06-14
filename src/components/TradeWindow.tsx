import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Clock, Shield, CheckCircle2, AlertTriangle, Copy, MessageSquare, Loader2, Timer } from "lucide-react";
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { P2P_CONTRACT_ADDRESS } from "@/config/wagmi";
import { P2P_ESCROW_ABI } from "@/config/abi";
import { toast } from "sonner";
import { parseUnits } from "viem";
import { playSuccessChime, playAlertChime } from "@/lib/sounds";
import ChatPanel from "./ChatPanel";
import { parsePaymentInfo } from "@/lib/parsePaymentInfo";
import UpiQrCode from "./UpiQrCode";

type DealStep = "accept" | "pay" | "waiting" | "completed" | "cancelled" | "disputed";

interface TradeAd {
  adId: number;
  seller: string;
  token: string;
  tokenSymbol: string;
  tokenAmount: string;
  pricePerToken: string;
  inrTotal: string;
  dealTimeout: number;
  paymentInfo: string;
  minFillAmount?: string;
}

interface TradeWindowProps {
  ad: TradeAd;
  userAddress: string;
  onClose: () => void;
}

const formatTime = (seconds: number) => {
  if (seconds <= 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const TradeWindow = ({ ad, userAddress, onClose }: TradeWindowProps) => {
  const navigate = useNavigate();
  const [step, setStep] = useState<DealStep>("accept");
  const [timeLeft, setTimeLeft] = useState(ad.dealTimeout);
  const [showChat, setShowChat] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dealId, setDealId] = useState<number | null>(null);
  // Integer-only buy amount. Default to seller's minimum (or 1).
  const minAmount = Math.max(1, Math.floor(parseFloat(ad.minFillAmount || "1") || 1));
  const maxAmount = Math.floor(parseFloat(ad.tokenAmount) || 0);
  const [buyAmount, setBuyAmount] = useState<string>(String(Math.min(minAmount, maxAmount || minAmount)));
  const isSeller = ad.seller.toLowerCase() === userAddress.toLowerCase();

  const buyNum = parseInt(buyAmount, 10);
  const buyNumSafe = Number.isFinite(buyNum) ? buyNum : 0;
  const priceNum = parseFloat(ad.pricePerToken) || 0;
  const buyInrTotal = useMemo(() => (buyNumSafe * priceNum).toFixed(2), [buyNumSafe, priceNum]);
  const amountValid =
    Number.isInteger(buyNumSafe) && buyNumSafe >= minAmount && buyNumSafe <= maxAmount;
  const payoutInr = step === "accept" ? buyInrTotal : ad.inrTotal;
  const payoutAmount = step === "accept" ? String(buyNumSafe || minAmount) : ad.tokenAmount;
  const timeoutMin = Math.round(ad.dealTimeout / 60);

  // Read nextDealId BEFORE accepting — this will be the dealId assigned
  const { data: nextDealId } = useReadContract({
    address: P2P_CONTRACT_ADDRESS,
    abi: P2P_ESCROW_ABI,
    functionName: "nextDealId",
    query: { refetchInterval: 3000 },
  });

  // Contract write hooks
  const { writeContract: acceptAd, data: acceptHash, isPending: acceptPending } = useWriteContract();
  const { isSuccess: acceptConfirmed } = useWaitForTransactionReceipt({ hash: acceptHash });

  const { writeContract: confirmPayment, data: payHash, isPending: payPending } = useWriteContract();
  const { isSuccess: payConfirmed } = useWaitForTransactionReceipt({ hash: payHash });

  const { writeContract: sellerConfirm, data: sellerHash, isPending: sellerPending } = useWriteContract();
  const { isSuccess: sellerConfirmDone } = useWaitForTransactionReceipt({ hash: sellerHash });

  const { writeContract: raiseDispute, data: disputeHash, isPending: disputePending } = useWriteContract();
  const { isSuccess: disputeConfirmed } = useWaitForTransactionReceipt({ hash: disputeHash });

  const { writeContract: cancelDeal, data: cancelHash, isPending: cancelPending } = useWriteContract();
  const { isSuccess: cancelConfirmed } = useWaitForTransactionReceipt({ hash: cancelHash });

  // Countdown timer
  useEffect(() => {
    if (step !== "pay" && step !== "waiting") return;
    if (timeLeft <= 0) {
      setStep("cancelled");
      return;
    }
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  // After accept confirmed → close modal and go to My Deals
  useEffect(() => {
    if (acceptConfirmed) {
      toast.success("Deal accepted! Redirecting to My Deals…");
      playSuccessChime();
      onClose();
      navigate("/my-orders");
    }
  }, [acceptConfirmed]);

  // After buyer confirms payment
  useEffect(() => {
    if (payConfirmed) {
      toast.success("Payment confirmed on-chain. Waiting for seller.");
      playSuccessChime();
      setStep("waiting");
    }
  }, [payConfirmed]);

  // After seller confirms receipt
  useEffect(() => {
    if (sellerConfirmDone) {
      toast.success("Trade completed! Tokens released.");
      playSuccessChime();
      setStep("completed");
    }
  }, [sellerConfirmDone]);

  // After dispute raised
  useEffect(() => {
    if (disputeConfirmed) {
      toast.info("Dispute raised. Admin will review.");
      playAlertChime();
      setStep("disputed");
    }
  }, [disputeConfirmed]);

  // After cancel confirmed
  useEffect(() => {
    if (cancelConfirmed) {
      toast.success("Deal cancelled. Funds returned to seller.");
      setStep("cancelled");
    }
  }, [cancelConfirmed]);

  const handleAcceptDeal = () => {
    if (!amountValid) {
      toast.error(`Enter a whole number between ${minAmount} and ${maxAmount} ${ad.tokenSymbol}`);
      return;
    }
    // Capture the nextDealId before sending the tx
    if (nextDealId) {
      setDealId(Number(nextDealId));
    }
    acceptAd({
      address: P2P_CONTRACT_ADDRESS,
      abi: P2P_ESCROW_ABI,
      functionName: "takeDeal",
      args: [BigInt(ad.adId), parseUnits(String(buyNumSafe), 18)],
    } as any);
  };

  const handleConfirmPayment = () => {
    if (!dealId) {
      toast.error("Deal ID not found. Please try from My Deals page.");
      return;
    }
    confirmPayment({
      address: P2P_CONTRACT_ADDRESS,
      abi: P2P_ESCROW_ABI,
      functionName: "markPaid",
      args: [BigInt(dealId)],
    } as any);
  };

  const handleSellerConfirm = () => {
    if (!dealId) {
      toast.error("Deal ID not found.");
      return;
    }
    sellerConfirm({
      address: P2P_CONTRACT_ADDRESS,
      abi: P2P_ESCROW_ABI,
      functionName: "confirmReceived",
      args: [BigInt(dealId)],
    } as any);
  };

  const handleRaiseDispute = () => {
    if (!dealId) return;
    raiseDispute({
      address: P2P_CONTRACT_ADDRESS,
      abi: P2P_ESCROW_ABI,
      functionName: "raiseDispute",
      args: [BigInt(dealId)],
    } as any);
  };

  const handleCancelTimedOut = () => {
    if (!dealId) return;
    cancelDeal({
      address: P2P_CONTRACT_ADDRESS,
      abi: P2P_ESCROW_ABI,
      functionName: "sellerReclaimExpired",
      args: [BigInt(dealId)],
    } as any);
  };

  const parsedPayment = parsePaymentInfo(ad.paymentInfo);

  const handleCopyPaymentInfo = () => {
    navigator.clipboard.writeText(parsedPayment.copyableDetail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const timePercent = (timeLeft / ad.dealTimeout) * 100;
  const isUrgent = timeLeft < 120;
  const isProcessing = acceptPending || payPending || sellerPending || disputePending || cancelPending;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="relative flex w-full sm:mx-4 sm:max-w-2xl flex-col rounded-t-xl sm:rounded-xl border border-border bg-card shadow-2xl animate-fade-up max-h-[95vh] sm:max-h-[90vh] overflow-hidden safe-bottom">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">
              {isSeller ? "Sell" : "Buy"} {ad.tokenSymbol}
            </h2>
            {dealId && (
              <span className="text-xs text-muted-foreground font-mono">Deal #{dealId}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {dealId !== null && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={() => setShowChat(!showChat)}
              >
                <MessageSquare className="h-4 w-4" />
                Chat
              </Button>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
            {/* Timer bar */}
            {(step === "pay" || step === "waiting") && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className={`flex items-center gap-1.5 ${isUrgent ? "text-sell" : "text-muted-foreground"}`}>
                    <Clock className="h-4 w-4" />
                    <span className="font-medium font-mono">{formatTime(timeLeft)}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {step === "pay" ? "Time to pay" : "Waiting for seller"}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      isUrgent ? "bg-sell" : "bg-primary"
                    }`}
                    style={{ width: `${timePercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Status Steps */}
            <div className="flex items-center gap-2 text-xs">
              {["Accept", "Pay", "Confirm", "Complete"].map((label, i) => {
                const stepIndex = { accept: 0, pay: 1, waiting: 2, completed: 3, cancelled: -1, disputed: -1 }[step];
                const isActive = i === stepIndex;
                const isDone = i < (stepIndex ?? 0);
                return (
                  <div key={label} className="flex items-center gap-2 flex-1">
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                        isDone
                          ? "bg-buy text-buy-foreground"
                          : isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-surface-3 text-muted-foreground"
                      }`}
                    >
                      {isDone ? "✓" : i + 1}
                    </div>
                    <span className={`hidden sm:inline ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {label}
                    </span>
                    {i < 3 && <div className="h-px flex-1 bg-border" />}
                  </div>
                );
              })}
            </div>

            {/* Trade Summary */}
            <div className="rounded-lg border border-border bg-surface-1 p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{step === "accept" ? "You buy" : "Token"}</span>
                <span className="font-medium text-foreground tabular-nums">{payoutAmount} {ad.tokenSymbol}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Price</span>
                <span className="font-medium text-foreground tabular-nums">₹{ad.pricePerToken} / {ad.tokenSymbol}</span>
              </div>
              {step === "accept" && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Available</span>
                  <span className="text-foreground tabular-nums">{ad.tokenAmount} {ad.tokenSymbol}</span>
                </div>
              )}
              <div className="h-px bg-border" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">You pay</span>
                <span className="text-lg font-bold text-primary tabular-nums">₹{payoutInr}</span>
              </div>
            </div>

            {/* Step-specific content */}
            {step === "accept" && (
              <div className="space-y-4">
                {/* Partial buy input */}
                {!isSeller && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-foreground">How much {ad.tokenSymbol} to buy?</label>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        Min: {minAmount} · Max: {maxAmount}
                      </span>
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={minAmount}
                        max={maxAmount}
                        step={1}
                        value={buyAmount}
                        onChange={(e) => {
                          // Whole numbers only — strip anything else.
                          const v = e.target.value.replace(/[^\d]/g, "");
                          setBuyAmount(v);
                        }}
                        onKeyDown={(e) => {
                          if (["e", "E", "+", "-", ".", ","].includes(e.key)) e.preventDefault();
                        }}
                        className="bg-surface-2 border-input pr-16 text-base h-11"
                        placeholder={String(minAmount)}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                        {ad.tokenSymbol}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Whole numbers only. Seller's minimum per trade is {minAmount} {ad.tokenSymbol}.
                    </p>
                    {!amountValid && buyAmount !== "" && (
                      <p className="text-xs text-sell">
                        Enter a whole number between {minAmount} and {maxAmount} {ad.tokenSymbol}.
                      </p>
                    )}
                  </div>
                )}

                {/* Payment window warning */}
                <div className="rounded-lg border border-sell/20 bg-sell/5 p-3 flex gap-2.5">
                  <Timer className="h-4 w-4 text-sell shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground">
                      You'll have {timeoutMin} minute{timeoutMin > 1 ? "s" : ""} to pay
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      After accepting, escrow locks {ad.tokenSymbol} and a {timeoutMin}-min payment window starts. If you don't pay & confirm in time, the deal auto-cancels and tokens return to the seller.
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-surface-1 p-4">
                  <p className="text-xs text-muted-foreground mb-1">Seller's address</p>
                  <p className="text-sm font-mono text-foreground break-all">{ad.seller}</p>
                </div>
                <Button variant="buy" className="w-full min-h-[48px]" size="lg" onClick={handleAcceptDeal} disabled={isProcessing || !amountValid}>
                  {acceptPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {acceptPending ? "Confirm in wallet…" : `Accept Deal — Lock ${payoutAmount} ${ad.tokenSymbol}`}
                </Button>
              </div>
            )}

            {step === "pay" && (
              <div className="space-y-4">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <p className="text-sm font-semibold text-foreground">Payment Details</p>
                  {parsedPayment.name && (
                    <p className="text-xs text-muted-foreground">Pay to: <span className="text-foreground font-medium">{parsedPayment.name}</span> via <span className="text-foreground font-medium">{parsedPayment.method}</span></p>
                  )}
                  <div className="flex items-center justify-between gap-2 rounded-md bg-surface-2 p-3">
                    <div className="text-sm font-mono text-foreground break-all space-y-1">
                      {parsedPayment.fields.map((f, i) => (
                        <p key={i}><span className="text-muted-foreground text-xs">{f.label}:</span> {f.value}</p>
                      ))}
                    </div>
                    <button onClick={handleCopyPaymentInfo} className="shrink-0 text-primary hover:text-primary/80" title="Copy payment detail">
                      {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                  {parsedPayment.upiLink && (
                    <UpiQrCode upiLink={parsedPayment.upiLink} amount={ad.inrTotal} />
                  )}
                  <p className="text-xs text-muted-foreground">
                    Send exactly ₹{ad.inrTotal} to the above details. After payment, click confirm below.
                  </p>
                </div>
                <Button variant="buy" className="w-full min-h-[48px]" size="lg" onClick={handleConfirmPayment} disabled={isProcessing}>
                  {payPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {payPending ? "Confirming…" : `I've Sent ₹${ad.inrTotal} — Confirm Payment`}
                </Button>
                {timeLeft <= 0 && (
                  <Button
                    variant="outline"
                    className="w-full text-sell border-sell/30"
                    size="sm"
                    onClick={handleRaiseDispute}
                    disabled={isProcessing}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Raise Dispute
                  </Button>
                )}
              </div>
            )}

            {step === "waiting" && !isSeller && (
              <div className="rounded-lg border border-border bg-surface-1 p-6 text-center space-y-3">
                <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground">Waiting for seller to confirm receipt</p>
                <p className="text-xs text-muted-foreground">
                  The seller will verify your payment and release the tokens.
                </p>
                {timeLeft <= 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-sell border-sell/30"
                    onClick={handleRaiseDispute}
                    disabled={isProcessing}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Raise Dispute
                  </Button>
                )}
              </div>
            )}

            {step === "waiting" && isSeller && (
              <div className="space-y-4">
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center space-y-2">
                  <p className="text-sm font-medium text-foreground">Buyer says they've paid ₹{ad.inrTotal}</p>
                  <p className="text-xs text-muted-foreground">
                    Verify the payment in your bank/UPI. Only confirm if you've received the full amount.
                  </p>
                </div>
                <Button variant="buy" className="w-full min-h-[48px]" size="lg" onClick={handleSellerConfirm} disabled={isProcessing}>
                  {sellerPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  {sellerPending ? "Confirming…" : `I Received ₹${ad.inrTotal} — Release Tokens`}
                </Button>
                <Button
                  variant="outline"
                  className="w-full text-sell border-sell/30"
                  size="sm"
                  onClick={handleRaiseDispute}
                  disabled={isProcessing}
                >
                  {disputePending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
                  Raise Dispute — I didn't receive payment
                </Button>
              </div>
            )}

            {step === "completed" && (
              <div className="rounded-lg border border-buy/20 bg-buy/5 p-6 text-center space-y-3">
                <div className="mx-auto h-14 w-14 rounded-full bg-buy/10 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-buy" />
                </div>
                <p className="text-lg font-bold text-foreground">Trade Completed!</p>
                <p className="text-sm text-muted-foreground">
                  {ad.tokenAmount} {ad.tokenSymbol} has been released to the buyer.
                </p>
                <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
              </div>
            )}

            {step === "cancelled" && (
              <div className="space-y-4">
                <div className="rounded-lg border border-sell/20 bg-sell/5 p-6 text-center space-y-3">
                  <div className="mx-auto h-14 w-14 rounded-full bg-sell/10 flex items-center justify-center">
                    <AlertTriangle className="h-8 w-8 text-sell" />
                  </div>
                  <p className="text-lg font-bold text-foreground">Deal Timed Out</p>
                  <p className="text-sm text-muted-foreground">
                    Payment was not confirmed in time.
                  </p>
                </div>
                {dealId && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleCancelTimedOut}
                    disabled={isProcessing}
                  >
                    {cancelPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Cancel Deal — Reclaim Funds
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="w-full" onClick={onClose}>Close</Button>
              </div>
            )}

            {step === "disputed" && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-6 text-center space-y-3">
                <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <AlertTriangle className="h-8 w-8 text-primary" />
                </div>
                <p className="text-lg font-bold text-foreground">Dispute Raised</p>
                <p className="text-sm text-muted-foreground">
                  Admin will review the evidence and resolve this dispute.
                </p>
                <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
              </div>
            )}

            {/* Cancel timed-out deal button during active deal */}
            {(step === "pay" || step === "waiting") && timeLeft <= 0 && dealId && (
              <Button
                variant="outline"
                className="w-full text-sell border-sell/30"
                onClick={handleCancelTimedOut}
                disabled={isProcessing}
              >
                {cancelPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Cancel Timed-Out Deal — Reclaim Funds
              </Button>
            )}
          </div>

          {/* Chat sidebar */}
          {showChat && dealId !== null && (
            <div className="w-80 border-l border-border flex-shrink-0">
              <ChatPanel dealId={dealId} userAddress={userAddress} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TradeWindow;
