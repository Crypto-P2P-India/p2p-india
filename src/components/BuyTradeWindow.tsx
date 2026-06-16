import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Shield, Loader2, AlertTriangle, Wallet } from "lucide-react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useSwitchChain } from "wagmi";
import { bsc } from "wagmi/chains";
import { parseUnits, formatUnits } from "viem";
import { BUY_ESCROW_ADDRESS, BUY_ESCROW_ABI } from "@/config/buyEscrowAbi";
import { USDT_ADDRESS } from "@/config/wagmi";
import { ERC20_ABI } from "@/config/abi";
import { toast } from "sonner";
import { playSuccessChime } from "@/lib/sounds";
import type { LiveBuyAd } from "@/hooks/useBuyContractAds";

interface Props {
  ad: LiveBuyAd;
  userAddress: string;
  onClose: () => void;
}

const BuyTradeWindow = ({ ad, userAddress, onClose }: Props) => {
  const navigate = useNavigate();
  const { chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const wrongNet = chainId !== bsc.id;

  const DECIMALS = 2; // USDT input precision
  const roundDown = (n: number, d: number) => Math.floor(n * 10 ** d) / 10 ** d;
  const minAmt = Math.max(0.01, parseFloat(ad.minTradeUsdt) || 0.01);
  const maxAmt = roundDown(parseFloat(ad.remainingUsdt) || 0, DECIMALS);
  const fmt = (n: number) => parseFloat(n.toFixed(DECIMALS)).toString();
  const [sellAmount, setSellAmount] = useState(fmt(Math.min(minAmt, maxAmt || minAmt)));

  const sellNum = parseFloat(sellAmount);
  const sellSafe = Number.isFinite(sellNum) ? sellNum : 0;
  const decUsed = (sellAmount.split(".")[1] || "").length;
  const valid = sellSafe >= minAmt && sellSafe <= maxAmt && decUsed <= DECIMALS;
  const rate = parseFloat(ad.rateInrPerUsdt) || 0;
  const inrTotal = useMemo(() => (sellSafe * rate).toFixed(2), [sellSafe, rate]);

  const isSelf = ad.buyer.toLowerCase() === userAddress.toLowerCase();
  const amountWei = sellSafe > 0 ? parseUnits(fmt(sellSafe), 18) : 0n;
  // Seller upfront fee = amount * sellerFeeBps / 10000
  const sellerFeeWei = (amountWei * BigInt(ad.sellerFeeBps)) / 10000n;
  const totalNeededWei = amountWei + sellerFeeWei;

  // USDT balance
  const { data: usdtBal } = useReadContract({
    address: USDT_ADDRESS, abi: ERC20_ABI, functionName: "balanceOf",
    args: [userAddress as `0x${string}`],
    query: { refetchInterval: 5000 },
  });

  // Allowance to buy escrow contract
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDT_ADDRESS, abi: ERC20_ABI, functionName: "allowance",
    args: [userAddress as `0x${string}`, BUY_ESCROW_ADDRESS],
    query: { refetchInterval: 5000 },
  });
  const needsApproval = (allowance as bigint | undefined) === undefined || (allowance as bigint) < totalNeededWei;

  const bal = usdtBal ? parseFloat(formatUnits(usdtBal as bigint, 18)) : 0;
  const exceeds = parseFloat(formatUnits(totalNeededWei, 18)) > bal;

  const { writeContract: approve, data: appHash, isPending: appPending, error: appErr } = useWriteContract();
  const { isSuccess: appOk } = useWaitForTransactionReceipt({ hash: appHash });

  const { writeContract: accept, data: accHash, isPending: accPending, error: accErr } = useWriteContract();
  const { isSuccess: accOk, isLoading: accConfirming } = useWaitForTransactionReceipt({ hash: accHash });

  const [step, setStep] = useState<"form" | "approving" | "accepting" | "done">("form");

  useEffect(() => {
    if (appErr) { toast.error("Approval cancelled"); setStep("form"); }
  }, [appErr]);
  useEffect(() => {
    if (accErr) {
      const m = (accErr as any)?.shortMessage || accErr.message || "Failed";
      toast.error(m.toLowerCase().includes("reject") ? "Cancelled in wallet" : m);
      setStep("form");
    }
  }, [accErr]);

  useEffect(() => {
    if (appOk && step === "approving") {
      refetchAllowance();
      setStep("accepting");
      doAccept();
    }
  }, [appOk]);

  useEffect(() => {
    if (accOk && step === "accepting") {
      toast.success("Deal accepted! USDT locked in escrow.");
      playSuccessChime();
      setStep("done");
      onClose();
      navigate("/my-orders");
    }
  }, [accOk]);

  const doAccept = () => {
    try {
      accept({
        address: BUY_ESCROW_ADDRESS,
        abi: BUY_ESCROW_ABI,
        functionName: "acceptDeal",
        args: [BigInt(ad.adId), amountWei],
      } as any);
    } catch (e: any) {
      toast.error(e?.shortMessage || "Failed");
      setStep("form");
    }
  };

  const handleSubmit = () => {
    if (!valid) { toast.error(`Enter ${minAmt}–${maxAmt} USDT (max ${DECIMALS} decimals)`); return; }
    if (exceeds) { toast.error("Insufficient USDT"); return; }
    if (isSelf) { toast.error("Cannot accept your own ad"); return; }
    if (needsApproval) {
      setStep("approving");
      try {
        approve({
          address: USDT_ADDRESS, abi: ERC20_ABI, functionName: "approve",
          args: [BUY_ESCROW_ADDRESS, totalNeededWei],
        } as any);
      } catch (e: any) { toast.error(e?.shortMessage || "Failed"); setStep("form"); }
    } else {
      setStep("accepting");
      doAccept();
    }
  };

  const processing = step !== "form" && step !== "done";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full sm:mx-4 sm:max-w-lg max-h-[95vh] overflow-y-auto rounded-t-xl sm:rounded-xl border border-border bg-card p-5 sm:p-6 shadow-2xl animate-fade-up safe-bottom">
        <button onClick={() => !processing && onClose()} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground" disabled={processing}>
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <Shield className="h-5 w-5 text-sell" />
          <h2 className="text-lg font-bold text-foreground">Sell USDT to buyer</h2>
        </div>

        {wrongNet ? (
          <div className="text-center py-10 space-y-4">
            <AlertTriangle className="h-10 w-10 text-sell mx-auto" />
            <p className="text-foreground font-semibold">Wrong network</p>
            <Button onClick={() => switchChain({ chainId: bsc.id })}>Switch to BNB Chain</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-surface-1 p-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Buyer</span>
                <span className="font-mono text-foreground">{ad.buyer.slice(0, 6)}…{ad.buyer.slice(-4)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Buyer's name</span>
                <span className="text-foreground">{ad.name}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Pays via</span>
                <span className="text-foreground">{ad.paymentMethod}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Rate</span>
                <span className="text-foreground font-medium tabular-nums">₹{ad.rateInrPerUsdt} / USDT</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Available range</span>
                <span className="text-foreground tabular-nums">{minAmt} – {maxAmt} USDT</span>
              </div>
            </div>

            {/* Amount input */}
            <div className="rounded-lg border border-sell/20 bg-sell/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-foreground">How much USDT to sell?</label>
                <span className="text-xs text-muted-foreground tabular-nums flex items-center gap-1">
                  <Wallet className="h-3 w-3" /> {bal.toFixed(2)} USDT
                </span>
              </div>
              <div className="relative">
                <Input
                  type="text" inputMode="decimal"
                  value={sellAmount}
                  onChange={(e) => {
                    let v = e.target.value.replace(/[^\d.]/g, "");
                    const firstDot = v.indexOf(".");
                    if (firstDot !== -1) {
                      v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
                      const [i, d = ""] = v.split(".");
                      v = i + "." + d.slice(0, DECIMALS);
                    }
                    setSellAmount(v);
                  }}
                  onKeyDown={(e) => { if (["e","E","+","-",","].includes(e.key)) e.preventDefault(); }}
                  className="bg-surface-2 border-input pr-16 text-base h-11"
                  disabled={processing}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">USDT</span>
              </div>
              {!valid && sellAmount !== "" && (
                <p className="text-xs text-sell">Enter {minAmt}–{maxAmt} USDT (max {DECIMALS} decimals).</p>
              )}
              {exceeds && (
                <p className="text-xs text-sell">Insufficient USDT (need {parseFloat(formatUnits(totalNeededWei, 18)).toFixed(4)}).</p>
              )}
            </div>

            {/* Summary */}
            <div className="rounded-lg border border-border bg-surface-1 p-3 space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">You lock</span><span className="font-medium text-foreground tabular-nums">{parseFloat(formatUnits(amountWei, 18)).toFixed(2)} USDT</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Seller fee (0.1%)</span><span className="font-medium text-foreground tabular-nums">{parseFloat(formatUnits(sellerFeeWei, 18)).toFixed(4)} USDT</span></div>
              <div className="flex justify-between border-t border-border pt-1.5"><span className="font-medium text-foreground">Total deposit</span><span className="font-bold text-sell tabular-nums">{parseFloat(formatUnits(totalNeededWei, 18)).toFixed(4)} USDT</span></div>
              <div className="flex justify-between pt-1"><span className="text-muted-foreground">Buyer will pay you (INR, off-chain)</span><span className="font-bold text-buy tabular-nums">₹{inrTotal}</span></div>
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
              After accepting, the buyer has <span className="font-semibold text-foreground">{Math.round(ad.paymentWindow / 60)} min</span> to send ₹{inrTotal} to your saved payment details. You'll release USDT after confirming receipt in your bank/UPI.
            </div>

            <Button
              variant="sell" className="w-full min-h-[48px]" size="lg"
              disabled={!valid || exceeds || isSelf || processing}
              onClick={handleSubmit}
            >
              {processing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {step === "approving" ? "Approving USDT…"
                : step === "accepting" ? "Locking USDT…"
                : needsApproval ? `Approve & Lock ${fmt(sellSafe)} USDT`
                : `Lock ${fmt(sellSafe)} USDT — Accept Deal`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BuyTradeWindow;
