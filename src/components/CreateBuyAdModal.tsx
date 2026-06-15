import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Loader2, AlertTriangle } from "lucide-react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from "wagmi";
import { bsc } from "wagmi/chains";
import { parseUnits } from "viem";
import { BUY_ESCROW_ADDRESS, BUY_ESCROW_ABI } from "@/config/buyEscrowAbi";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props { open: boolean; onClose: () => void; }

const PAY_WINDOW_OPTIONS = [
  { label: "15 min", value: 15 * 60 },
  { label: "30 min", value: 30 * 60 },
] as const;

const AD_DURATION_OPTIONS = [
  { label: "1 day", value: 1 * 24 * 60 * 60 },
  { label: "2 days", value: 2 * 24 * 60 * 60 },
  { label: "3 days", value: 3 * 24 * 60 * 60 },
  { label: "5 days", value: 5 * 24 * 60 * 60 },
  { label: "7 days", value: 7 * 24 * 60 * 60 },
] as const;

const PAYMENT_METHODS = ["UPI", "Bank Transfer", "Google Pay", "PhonePe", "PayPal", "Wise", "Cash/Bank Deposit", "Digital Rupee"] as const;
type Method = typeof PAYMENT_METHODS[number];

const CreateBuyAdModal = ({ open, onClose }: Props) => {
  const { address, isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const isWrongNetwork = isConnected && chainId !== bsc.id;

  const [totalUsdt, setTotalUsdt] = useState("");
  const [minTrade, setMinTrade] = useState("");
  const [rate, setRate] = useState("");
  const [adDur, setAdDur] = useState<number>(24 * 60 * 60);
  const [payWin, setPayWin] = useState<number>(15 * 60);

  const [method, setMethod] = useState<Method | "">("");
  const [name, setName] = useState("");
  const [upiId, setUpiId] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [qrRef, setQrRef] = useState("");

  const [posting, setPosting] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Load saved profile
  useEffect(() => {
    if (!address || !open || profileLoaded) return;
    (async () => {
      const { data } = await supabase
        .from("wallet_payment_profiles")
        .select("*")
        .eq("wallet_address", address.toLowerCase())
        .maybeSingle();
      if (data) {
        if (data.seller_name) setName(data.seller_name);
        if (data.payment_method) setMethod(data.payment_method as Method);
        if (data.upi_id) setUpiId(data.upi_id);
        if (data.bank_name) setBankName(data.bank_name);
        if (data.account_number) setAccountNumber(data.account_number);
        if (data.ifsc_code) setIfsc(data.ifsc_code);
        if (data.payment_id) setPaymentId(data.payment_id);
      }
      setProfileLoaded(true);
    })();
  }, [address, open, profileLoaded]);

  const saveProfile = useCallback(async () => {
    if (!address) return;
    await supabase.from("wallet_payment_profiles").upsert({
      wallet_address: address.toLowerCase(),
      seller_name: name.trim(),
      payment_method: method,
      upi_id: upiId.trim(),
      bank_name: bankName.trim(),
      account_number: accountNumber.trim(),
      ifsc_code: ifsc.trim(),
      payment_id: paymentId.trim(),
    }, { onConflict: "wallet_address" });
  }, [address, name, method, upiId, bankName, accountNumber, ifsc, paymentId]);

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (error && posting) {
      const raw = (error as any)?.shortMessage || error.message || "Failed";
      toast.error(raw.toLowerCase().includes("reject") ? "Cancelled in wallet" : raw);
      setPosting(false);
    }
  }, [error, posting]);

  useEffect(() => {
    if (isSuccess && posting) {
      saveProfile();
      toast.success("Buy ad posted!");
      resetForm();
      onClose();
    }
  }, [isSuccess, posting]);

  const resetForm = () => {
    setTotalUsdt(""); setMinTrade(""); setRate("");
    setPosting(false); setProfileLoaded(false); reset();
  };

  const totalNum = parseFloat(totalUsdt) || 0;
  const minNum = parseFloat(minTrade) || 0;
  const rateNum = parseFloat(rate) || 0;
  const inrTotal = totalNum * rateNum;

  const buildPayFields = () => {
    let upiOrAccount = "";
    let bankOrIfsc = "";
    if (method === "UPI") { upiOrAccount = upiId.trim(); }
    else if (method === "Bank Transfer" || method === "Cash/Bank Deposit") {
      upiOrAccount = accountNumber.trim();
      bankOrIfsc = `${bankName.trim()} | ${ifsc.trim()}`;
    } else { upiOrAccount = paymentId.trim(); }
    return { upiOrAccount, bankOrIfsc };
  };

  const isPayValid = (): boolean => {
    if (!name.trim() || !method) return false;
    if (method === "UPI") return !!upiId.trim();
    if (method === "Bank Transfer" || method === "Cash/Bank Deposit")
      return !!bankName.trim() && !!accountNumber.trim() && !!ifsc.trim();
    return !!paymentId.trim();
  };

  const canSubmit =
    !!totalUsdt && !!minTrade && !!rate && totalNum >= 1 && totalNum <= 50000 &&
    minNum > 0 && minNum <= totalNum && rateNum > 0 && isPayValid() && !posting && !isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const { upiOrAccount, bankOrIfsc } = buildPayFields();
    setPosting(true);
    try {
      writeContract({
        address: BUY_ESCROW_ADDRESS,
        abi: BUY_ESCROW_ABI,
        functionName: "createAd",
        args: [{
          totalAmount: parseUnits(totalUsdt, 18),
          minTrade: parseUnits(minTrade, 18),
          rateInrPerUsdt: parseUnits(rate, 2),
          durationSeconds: adDur,
          paymentWindow: payWin,
          paymentMethod: method as string,
          name: name.trim(),
          upiOrAccount,
          bankOrIfsc,
          qrRef: qrRef.trim(),
        }],
      } as any);
    } catch (e: any) {
      toast.error(e?.shortMessage || "Failed");
      setPosting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full sm:mx-4 sm:w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto rounded-t-xl sm:rounded-xl border border-border bg-card p-5 sm:p-6 shadow-2xl animate-fade-up safe-bottom">
        <button
          onClick={() => { if (!posting) { resetForm(); onClose(); } }}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          disabled={posting}
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-lg font-bold text-foreground mb-1">Create Buy Ad</h2>
        <p className="text-xs text-muted-foreground mb-5">You want to receive USDT and pay INR. No USDT lock now — sellers lock USDT when they accept.</p>

        {!isConnected ? (
          <div className="text-center py-8 text-sm text-muted-foreground">Connect your wallet to create a buy ad</div>
        ) : isWrongNetwork ? (
          <div className="text-center py-10 space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-buy/10">
              <AlertTriangle className="h-7 w-7 text-buy" />
            </div>
            <p className="text-foreground font-semibold">Wrong Network</p>
            <Button onClick={() => switchChain({ chainId: bsc.id })}>Switch to BNB Chain</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Amount */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">USDT you want to receive</Label>
              <Input type="number" placeholder="e.g. 100 (min $1, max $50,000)"
                value={totalUsdt} onChange={(e) => setTotalUsdt(e.target.value)}
                className="bg-surface-2 border-input" disabled={posting} />
              {totalNum > 50000 && <p className="text-xs text-destructive mt-1">Max is 50,000 USDT.</p>}
              {totalNum > 0 && totalNum < 1 && <p className="text-xs text-destructive mt-1">Min is 1 USDT.</p>}
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Min trade per seller (USDT)</Label>
              <Input type="number" placeholder="e.g. 10"
                value={minTrade} onChange={(e) => setMinTrade(e.target.value)}
                className="bg-surface-2 border-input" disabled={posting} />
              {minNum > totalNum && totalNum > 0 && <p className="text-xs text-destructive mt-1">Cannot exceed total.</p>}
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Rate (INR per 1 USDT)</Label>
              <Input type="number" placeholder="e.g. 92.50" step="0.01"
                value={rate} onChange={(e) => setRate(e.target.value)}
                className="bg-surface-2 border-input" disabled={posting} />
            </div>

            {/* Payment method */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">How will you pay INR?</Label>
              <div className="flex flex-wrap gap-1.5">
                {PAYMENT_METHODS.map((m) => (
                  <button key={m} type="button" onClick={() => setMethod(m)} disabled={posting}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                      method === m ? "bg-primary/15 text-primary border border-primary/30"
                        : "bg-surface-3 text-muted-foreground hover:text-foreground border border-transparent"
                    }`}>{m}</button>
                ))}
              </div>
            </div>

            {method && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Your name (shown to seller)</Label>
                <Input placeholder="e.g. Ravi Kumar" value={name} onChange={(e) => setName(e.target.value)}
                  className="bg-surface-2 border-input" disabled={posting} maxLength={100} />
              </div>
            )}

            {method === "UPI" && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Your UPI ID</Label>
                <Input placeholder="yourname@ybl" value={upiId} onChange={(e) => setUpiId(e.target.value)}
                  className="bg-surface-2 border-input" disabled={posting} maxLength={100} />
              </div>
            )}
            {(method === "Bank Transfer" || method === "Cash/Bank Deposit") && (
              <div className="space-y-3">
                <div><Label className="text-xs text-muted-foreground mb-1.5 block">Bank Name</Label>
                  <Input placeholder="e.g. SBI" value={bankName} onChange={(e) => setBankName(e.target.value)}
                    className="bg-surface-2 border-input" disabled={posting} maxLength={100} /></div>
                <div><Label className="text-xs text-muted-foreground mb-1.5 block">Account Number</Label>
                  <Input placeholder="1234567890" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)}
                    className="bg-surface-2 border-input" disabled={posting} maxLength={30} /></div>
                <div><Label className="text-xs text-muted-foreground mb-1.5 block">IFSC Code</Label>
                  <Input placeholder="SBIN0001234" value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                    className="bg-surface-2 border-input" disabled={posting} maxLength={11} /></div>
              </div>
            )}
            {(method === "Google Pay" || method === "PhonePe") && (
              <div><Label className="text-xs text-muted-foreground mb-1.5 block">Phone Number or UPI</Label>
                <Input value={paymentId} onChange={(e) => setPaymentId(e.target.value)}
                  className="bg-surface-2 border-input" disabled={posting} maxLength={100} /></div>
            )}
            {(method === "PayPal" || method === "Wise") && (
              <div><Label className="text-xs text-muted-foreground mb-1.5 block">{method} Email/Username</Label>
                <Input value={paymentId} onChange={(e) => setPaymentId(e.target.value)}
                  className="bg-surface-2 border-input" disabled={posting} maxLength={100} /></div>
            )}
            {method === "Digital Rupee" && (
              <div><Label className="text-xs text-muted-foreground mb-1.5 block">Digital Rupee Wallet/ID</Label>
                <Input value={paymentId} onChange={(e) => setPaymentId(e.target.value)}
                  className="bg-surface-2 border-input" disabled={posting} maxLength={100} /></div>
            )}

            {/* Windows */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Seller pay window</Label>
                <div className="flex flex-wrap gap-1.5">
                  {PAY_WINDOW_OPTIONS.map((o) => (
                    <button key={o.value} type="button" onClick={() => setPayWin(o.value)} disabled={posting}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                        payWin === o.value ? "bg-primary text-primary-foreground"
                          : "bg-surface-3 text-muted-foreground hover:text-foreground"
                      }`}>{o.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Ad expires after</Label>
                <select value={adDur} onChange={(e) => setAdDur(Number(e.target.value))} disabled={posting}
                  className="w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm text-foreground">
                  {AD_DURATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {/* Summary */}
            {totalNum > 0 && rateNum > 0 && (
              <div className="rounded-lg border border-buy/20 bg-buy/5 p-3 space-y-1.5">
                <div className="text-xs font-semibold text-buy uppercase tracking-wide">Buy Ad Summary</div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">You receive (escrow → you)</span><span className="font-medium text-foreground tabular-nums">{totalUsdt} USDT</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">You pay (off-chain)</span><span className="font-medium text-foreground tabular-nums">₹{inrTotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Buyer fee on release</span><span className="font-medium text-foreground tabular-nums">0.15%</span></div>
              </div>
            )}

            <div className="h-20" />
            <div className="sticky bottom-0 left-0 right-0 bg-card pt-3 pb-6 -mb-5 sm:-mb-6 -mx-5 sm:-mx-6 px-5 sm:px-6 border-t border-border"
              style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
              <Button variant="buy" className="w-full" size="lg" disabled={!canSubmit} onClick={handleSubmit}>
                {(posting || isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {posting ? "Posting…" : "Post Buy Ad"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateBuyAdModal;
