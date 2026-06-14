import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Loader2, Wallet, TrendingUp, AlertTriangle } from "lucide-react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useBalance, useSwitchChain } from "wagmi";
import { bsc } from "wagmi/chains";
import { parseUnits, formatUnits } from "viem";
import { P2P_CONTRACT_ADDRESS, USDT_ADDRESS } from "@/config/wagmi";
import { P2P_ESCROW_ABI, ERC20_ABI } from "@/config/abi";
import { toast } from "sonner";
import { useBnbPrice } from "@/hooks/useBnbPrice";
import { supabase } from "@/integrations/supabase/client";

interface CreateOrderModalProps {
  open: boolean;
  onClose: () => void;
}

const NATIVE_BNB = "0x0000000000000000000000000000000000000000";
const SELLER_FEE_BPS = 15n;
const BPS_DENOM = 10000n;

const CRYPTOS = [
  { symbol: "USDT", address: USDT_ADDRESS },
  { symbol: "BNB", address: NATIVE_BNB },
];

const PAYMENT_METHODS = ["UPI", "Bank Transfer", "Google Pay", "PhonePe", "PayPal", "Wise", "Cash/Bank Deposit", "Digital Rupee"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

type Step = "form" | "approving" | "posting";

const CreateOrderModal = ({ open, onClose }: CreateOrderModalProps) => {
  const { address, isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const isWrongNetwork = isConnected && chainId !== bsc.id;
  const [crypto, setCrypto] = useState("USDT");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [allowPartial, setAllowPartial] = useState(false);
  const [minFill, setMinFill] = useState("");
  const [step, setStep] = useState<Step>("form");

  // Payment fields
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | "">("");
  const [sellerName, setSellerName] = useState("");
  // UPI fields
  const [upiId, setUpiId] = useState("");
  // Bank Transfer fields
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  // Generic payment ID (Google Pay, PhonePe, PayPal, Wise)
  const [paymentId, setPaymentId] = useState("");
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Load saved payment profile for this wallet
  useEffect(() => {
    if (!address || !open || profileLoaded) return;
    const loadProfile = async () => {
      const { data } = await supabase
        .from("wallet_payment_profiles")
        .select("*")
        .eq("wallet_address", address.toLowerCase())
        .maybeSingle();
      if (data) {
        if (data.seller_name) setSellerName(data.seller_name);
        if (data.payment_method) setSelectedMethod(data.payment_method as PaymentMethod);
        if (data.upi_id) setUpiId(data.upi_id);
        if (data.bank_name) setBankName(data.bank_name);
        if (data.account_number) setAccountNumber(data.account_number);
        if (data.ifsc_code) setIfscCode(data.ifsc_code);
        if (data.payment_id) setPaymentId(data.payment_id);
      }
      setProfileLoaded(true);
    };
    loadProfile();
  }, [address, open, profileLoaded]);

  // Save payment profile on successful ad creation
  const savePaymentProfile = useCallback(async () => {
    if (!address) return;
    const profileData = {
      wallet_address: address.toLowerCase(),
      seller_name: sellerName.trim(),
      payment_method: selectedMethod,
      upi_id: upiId.trim(),
      bank_name: bankName.trim(),
      account_number: accountNumber.trim(),
      ifsc_code: ifscCode.trim(),
      payment_id: paymentId.trim(),
    };
    await supabase
      .from("wallet_payment_profiles")
      .upsert(profileData, { onConflict: "wallet_address" });
  }, [address, sellerName, selectedMethod, upiId, bankName, accountNumber, ifscCode, paymentId]);

  const selectedToken = CRYPTOS.find((c) => c.symbol === crypto)!;
  const isBNB = crypto === "BNB";
  const tokenAmountWei = amount ? parseUnits(amount, 18) : BigInt(0);
  const minFillWei = allowPartial && minFill ? parseUnits(minFill, 18) : tokenAmountWei;
  const sellerFeeWei = (tokenAmountWei * SELLER_FEE_BPS) / BPS_DENOM;
  const createRequiredWei = tokenAmountWei + sellerFeeWei;
  const minFillInvalid = allowPartial && (!minFill || minFillWei <= BigInt(0) || minFillWei > tokenAmountWei);

  // For BNB: user enters INR per USD rate, we multiply by live BNB/USD price
  const { bnbPrice, isLoading: bnbPriceLoading } = useBnbPrice(isBNB && open);
  const effectivePricePerToken = isBNB && bnbPrice && price
    ? (parseFloat(price) * bnbPrice).toFixed(2)
    : price;
  const pricePerTokenWei = effectivePricePerToken ? parseUnits(effectivePricePerToken, 2) : BigInt(0);

  // Balances
  const { data: bnbBalance } = useBalance({
    address,
    query: { enabled: isBNB && !!address && open },
  });
  const { data: usdtBalance } = useReadContract({
    address: USDT_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !isBNB && !!address && open },
  });

  const walletBalance = isBNB
    ? bnbBalance ? parseFloat(formatUnits(bnbBalance.value, 18)) : 0
    : usdtBalance ? parseFloat(formatUnits(usdtBalance as bigint, 18)) : 0;
  const walletBalanceFormatted = walletBalance.toFixed(4);
  const maxSellAmount = walletBalance > 0 ? walletBalance / 1.0015 : 0;
  const createRequiredFormatted = formatUnits(createRequiredWei, 18);
  const createRequiredAmount = parseFloat(formatUnits(createRequiredWei, 18));
  const exceedsBalance = createRequiredAmount > walletBalance;

  // Allowance
  const { data: allowance } = useReadContract({
    address: USDT_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, P2P_CONTRACT_ADDRESS] : undefined,
    query: { enabled: !isBNB && !!address && open },
  });
  const needsApproval = !isBNB && (allowance === undefined || (allowance as bigint) < createRequiredWei);

  // Transactions
  const { writeContract: approve, data: approveTxHash, isPending: isApproving, reset: resetApprove, error: approveError } = useWriteContract();
  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveTxHash });
  const { writeContract: createAd, data: createTxHash, isPending: isCreating, reset: resetCreate, error: createError } = useWriteContract();
  const { isSuccess: createConfirmed } = useWaitForTransactionReceipt({ hash: createTxHash });

  // Handle tx errors — reset step and show toast
  useEffect(() => {
    if (approveError && step === "approving") {
      const msg = (approveError as any)?.shortMessage || approveError.message || "Approval failed";
      toast.error(msg.includes("insufficient") ? "Insufficient USDT balance in your wallet" : msg);
      setStep("form");
    }
  }, [approveError]);

  useEffect(() => {
    if (createError && step === "posting") {
      const msg = (createError as any)?.shortMessage || createError.message || "Transaction failed";
      toast.error(msg.includes("insufficient") ? `Insufficient ${crypto} balance in your wallet` : msg);
      setStep("form");
    }
  }, [createError]);

  useEffect(() => {
    if (approveConfirmed && step === "approving") {
      setStep("posting");
      submitCreateAd();
    }
  }, [approveConfirmed]);

  useEffect(() => {
    if (createConfirmed && step === "posting") {
      savePaymentProfile();
      toast.success("Ad posted successfully! Your tokens are in escrow.");
      resetForm();
      onClose();
    }
  }, [createConfirmed]);

  // Build payment info string
  const buildPaymentInfo = (): string => {
    const parts: string[] = [];
    parts.push(`Name: ${sellerName.trim()}`);
    parts.push(`Method: ${selectedMethod}`);

    if (selectedMethod === "UPI") {
      parts.push(`UPI: ${upiId.trim()}`);
    } else if (selectedMethod === "Bank Transfer") {
      parts.push(`Bank: ${bankName.trim()}`);
      parts.push(`A/C: ${accountNumber.trim()}`);
      parts.push(`IFSC: ${ifscCode.trim()}`);
    } else if (selectedMethod === "Google Pay" || selectedMethod === "PhonePe") {
      parts.push(`Phone/UPI: ${paymentId.trim()}`);
    } else if (selectedMethod === "PayPal" || selectedMethod === "Wise") {
      parts.push(`Email/ID: ${paymentId.trim()}`);
    } else if (selectedMethod === "Cash/Bank Deposit") {
      parts.push(`Bank: ${bankName.trim()}`);
      parts.push(`A/C: ${accountNumber.trim()}`);
      parts.push(`IFSC: ${ifscCode.trim()}`);
    } else if (selectedMethod === "Digital Rupee") {
      parts.push(`Wallet/ID: ${paymentId.trim()}`);
    }

    return parts.join(" | ");
  };

  const isPaymentValid = (): boolean => {
    if (!sellerName.trim() || !selectedMethod) return false;
    if (selectedMethod === "UPI") return !!upiId.trim();
    if (selectedMethod === "Bank Transfer" || selectedMethod === "Cash/Bank Deposit") return !!bankName.trim() && !!accountNumber.trim() && !!ifscCode.trim();
    return !!paymentId.trim();
  };

  const resetForm = () => {
    setPrice(""); setAmount("");
    setStep("form");
    setProfileLoaded(false);
    resetApprove(); resetCreate();
  };

  const submitCreateAd = () => {
    const paymentStr = buildPaymentInfo();
    try {
      createAd({
        address: P2P_CONTRACT_ADDRESS,
        abi: P2P_ESCROW_ABI,
        functionName: isBNB ? "createSellAdNative" : "createSellAdToken",
        args: isBNB
          ? [tokenAmountWei, tokenAmountWei, pricePerTokenWei, paymentStr]
          : [selectedToken.address as `0x${string}`, tokenAmountWei, tokenAmountWei, pricePerTokenWei, paymentStr],
        value: isBNB ? createRequiredWei : BigInt(0),
      } as any);
    } catch (e: any) {
      toast.error(e?.shortMessage || "Transaction failed");
      setStep("form");
    }
  };

  const handleSubmit = () => {
    if (!price || !amount || !isPaymentValid()) return;

    if (isBNB) {
      setStep("posting");
      submitCreateAd();
    } else if (needsApproval) {
      setStep("approving");
      try {
        approve({
          address: USDT_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [P2P_CONTRACT_ADDRESS, createRequiredWei],
        } as any);
      } catch (e: any) {
        toast.error(e?.shortMessage || "Approval failed");
        setStep("form");
      }
    } else {
      setStep("posting");
      submitCreateAd();
    }
  };

  const bnbUsdValue = isBNB && bnbPrice && amount ? (parseFloat(amount) * bnbPrice) : null;
  const inrTotal = price && amount
    ? isBNB && bnbPrice
      ? (parseFloat(price) * parseFloat(amount) * bnbPrice).toFixed(2)
      : (parseFloat(price) * parseFloat(amount)).toFixed(2)
    : "0.00";
  const isProcessing = step !== "form";
  const canSubmit = !!price && !!amount && isPaymentValid() && !isProcessing && !exceedsBalance && (!isBNB || bnbPrice !== null);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div
        className="relative w-full sm:mx-4 sm:w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto rounded-t-xl sm:rounded-xl border border-border bg-card p-5 sm:p-6 shadow-2xl animate-fade-up safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => { if (!isProcessing) { resetForm(); onClose(); } }}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
          disabled={isProcessing}
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-lg font-bold text-foreground mb-6">Create Sell Ad</h2>

        {!isConnected ? (
          <div className="text-center py-8 space-y-3">
            <p className="text-muted-foreground text-sm">Connect your wallet to create an ad</p>
          </div>
        ) : isWrongNetwork ? (
          <div className="text-center py-10 space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sell/10">
              <AlertTriangle className="h-7 w-7 text-sell" />
            </div>
            <div>
              <p className="text-foreground font-semibold">Wrong Network</p>
              <p className="text-muted-foreground text-sm mt-1">
                Please switch to <span className="font-semibold text-foreground">BNB Smart Chain</span> to create an ad.
              </p>
            </div>
            <Button onClick={() => switchChain({ chainId: bsc.id })} className="gap-2">
              Switch to BNB Chain
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Token */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Token to Sell</Label>
              <div className="flex flex-wrap gap-1.5">
                {CRYPTOS.map((c) => (
                  <button
                    key={c.symbol}
                    onClick={() => setCrypto(c.symbol)}
                    disabled={isProcessing}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                      crypto === c.symbol
                        ? "bg-primary text-primary-foreground"
                        : "bg-surface-3 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {c.symbol}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Method — FIRST */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Payment Method</Label>
              <div className="flex flex-wrap gap-1.5">
                {PAYMENT_METHODS.map((method) => (
                  <button
                    key={method}
                    onClick={() => { setSelectedMethod(method); setUpiId(""); setBankName(""); setAccountNumber(""); setIfscCode(""); setPaymentId(""); }}
                    disabled={isProcessing}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                      selectedMethod === method
                        ? "bg-primary/15 text-primary border border-primary/30"
                        : "bg-surface-3 text-muted-foreground hover:text-foreground border border-transparent"
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            {/* Seller Name — always shown once method selected */}
            {selectedMethod && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Your Name (shown to buyer)</Label>
                <Input
                  placeholder="e.g. Ravi Kumar"
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  className="bg-surface-2 border-input"
                  disabled={isProcessing}
                  maxLength={100}
                />
              </div>
            )}

            {/* Dynamic payment detail fields */}
            {selectedMethod === "UPI" && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">UPI ID</Label>
                <Input
                  placeholder="e.g. yourname@ybl"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className="bg-surface-2 border-input"
                  disabled={isProcessing}
                  maxLength={100}
                />
              </div>
            )}

            {selectedMethod === "Bank Transfer" && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Bank Name</Label>
                  <Input
                    placeholder="e.g. State Bank of India"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="bg-surface-2 border-input"
                    disabled={isProcessing}
                    maxLength={100}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Account Number</Label>
                  <Input
                    placeholder="e.g. 1234567890"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="bg-surface-2 border-input"
                    disabled={isProcessing}
                    maxLength={30}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">IFSC Code</Label>
                  <Input
                    placeholder="e.g. SBIN0001234"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                    className="bg-surface-2 border-input"
                    disabled={isProcessing}
                    maxLength={11}
                  />
                </div>
              </div>
            )}

            {(selectedMethod === "Google Pay" || selectedMethod === "PhonePe") && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Phone Number or UPI ID</Label>
                <Input
                  placeholder="e.g. 9876543210 or yourname@ybl"
                  value={paymentId}
                  onChange={(e) => setPaymentId(e.target.value)}
                  className="bg-surface-2 border-input"
                  disabled={isProcessing}
                  maxLength={100}
                />
              </div>
            )}

            {(selectedMethod === "PayPal" || selectedMethod === "Wise") && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">{selectedMethod} Email or Username</Label>
                <Input
                  placeholder={`e.g. your@email.com`}
                  value={paymentId}
                  onChange={(e) => setPaymentId(e.target.value)}
                  className="bg-surface-2 border-input"
                  disabled={isProcessing}
                  maxLength={100}
                />
              </div>
            )}

            {selectedMethod === "Cash/Bank Deposit" && (
              <div className="space-y-3">
                <p className="text-[11px] text-muted-foreground bg-surface-2 rounded-md px-2.5 py-1.5">
                  Buyer will deposit cash at your bank branch or ATM. Provide your bank details below.
                </p>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Bank Name</Label>
                  <Input
                    placeholder="e.g. State Bank of India"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="bg-surface-2 border-input"
                    disabled={isProcessing}
                    maxLength={100}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Account Number</Label>
                  <Input
                    placeholder="e.g. 1234567890"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="bg-surface-2 border-input"
                    disabled={isProcessing}
                    maxLength={30}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">IFSC Code</Label>
                  <Input
                    placeholder="e.g. SBIN0001234"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                    className="bg-surface-2 border-input"
                    disabled={isProcessing}
                    maxLength={11}
                  />
                </div>
              </div>
            )}

            {selectedMethod === "Digital Rupee" && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Digital Rupee Wallet / ID</Label>
                <Input
                  placeholder="e.g. your e₹ wallet ID"
                  value={paymentId}
                  onChange={(e) => setPaymentId(e.target.value)}
                  className="bg-surface-2 border-input"
                  disabled={isProcessing}
                  maxLength={100}
                />
              </div>
            )}

            {/* BNB Live Price */}
            {isBNB && (
              <div className="rounded-lg border border-border bg-surface-2 p-3">
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-buy" />
                  <span className="text-muted-foreground">Live BNB Price:</span>
                  {bnbPriceLoading || !bnbPrice ? (
                    <span className="text-muted-foreground animate-pulse">Fetching…</span>
                  ) : (
                    <span className="font-bold text-foreground tabular-nums">${bnbPrice.toFixed(2)}</span>
                  )}
                </div>
                {bnbPrice && amount && parseFloat(amount) > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {amount} BNB ≈ <span className="font-medium text-foreground">${bnbUsdValue?.toFixed(2)}</span> USD
                  </p>
                )}
              </div>
            )}

            {/* Price */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                {isBNB ? "INR rate per 1 USD" : `Price per ${crypto} (INR)`}
              </Label>
              <Input
                type="number"
                placeholder="e.g. 95"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="bg-surface-2 border-input"
                disabled={isProcessing}
              />
              {isBNB && price && bnbPrice && (
                <p className="text-xs text-muted-foreground mt-1">
                  Effective: <span className="font-medium text-foreground">₹{(parseFloat(price) * bnbPrice).toFixed(2)}</span> per BNB
                </p>
              )}
            </div>

            {/* Amount */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs text-muted-foreground">Amount ({crypto})</Label>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Wallet className="h-3 w-3" />
                  <span>{walletBalanceFormatted} {crypto}</span>
                  <button
                    type="button"
                    onClick={() => setAmount(maxSellAmount.toString())}
                    disabled={isProcessing || walletBalance <= 0}
                    className="text-primary font-medium hover:text-primary/80 transition-colors ml-1"
                  >
                    MAX
                  </button>
                </div>
              </div>
              <Input
                type="number"
                placeholder={isBNB ? "e.g. 0.1" : "e.g. 30"}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`bg-surface-2 border-input ${exceedsBalance && amount ? "border-destructive focus-visible:ring-destructive" : ""}`}
                disabled={isProcessing}
              />
              {exceedsBalance && amount && (
                <p className="text-xs text-destructive mt-1">
                  Insufficient balance. Deposit requires {createRequiredFormatted} {crypto} including escrow fee.
                </p>
              )}
            </div>

            {/* INR Total */}
            {price && amount && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-center">
                <span className="text-xs text-muted-foreground">Buyer will pay </span>
                <span className="text-lg font-bold text-primary">₹{inrTotal}</span>
                <p className="text-xs text-muted-foreground mt-1">
                  Deposit: {createRequiredFormatted} {crypto} including prepaid escrow fee
                </p>
                {isBNB && bnbPrice && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {amount} BNB × ${bnbPrice.toFixed(2)} × ₹{price} = ₹{inrTotal}
                  </p>
                )}
              </div>
            )}

            {/* Status indicators */}
            {step === "approving" && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center text-sm text-primary flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Approving USDT spend… confirm in wallet
              </div>
            )}
            {step === "posting" && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center text-sm text-primary flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Posting ad… confirm in wallet
              </div>
            )}

            {/* Spacer so content doesn't hide behind sticky button */}
            <div className="h-24" />

            {/* Sticky submit button */}
            <div className="sticky bottom-0 left-0 right-0 bg-card pt-3 pb-6 -mb-5 sm:-mb-6 -mx-5 sm:-mx-6 px-5 sm:px-6 border-t border-border" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
              <Button
                variant="sell"
                className="w-full"
                size="lg"
                disabled={!canSubmit}
                onClick={handleSubmit}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {step === "approving"
                  ? "Approving…"
                  : step === "posting"
                  ? "Posting…"
                  : isBNB
                  ? `Post Sell Ad — Deposit ${amount || "0"} BNB`
                  : needsApproval
                  ? `Approve & Post — Deposit ${amount || "0"} USDT`
                  : `Post Sell Ad — Deposit ${amount || "0"} USDT`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateOrderModal;
