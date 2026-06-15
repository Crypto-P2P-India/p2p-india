import { useState, useEffect } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { AlertTriangle, ExternalLink, MessageSquare, RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BUY_ESCROW_ABI, BUY_ESCROW_ADDRESS } from "@/config/buyEscrowAbi";
import { formatUnits, parseUnits } from "viem";
import { toast } from "sonner";
import ChatPanel from "@/components/ChatPanel";

const BUY_CHAT_OFFSET = 1_000_000;

const BUY_DEAL_STATUS_LABELS: Record<number, string> = {
  0: "None",
  1: "Locked",
  2: "Marked Paid",
  3: "Released",
  4: "Reclaimed",
  5: "Disputed",
  6: "Resolved (Buyer)",
  7: "Resolved (Seller)",
};

const BUY_DEAL_STATUS_COLORS: Record<number, string> = {
  1: "bg-blue-500/20 text-blue-400",
  2: "bg-yellow-500/20 text-yellow-400",
  3: "bg-green-500/20 text-green-400",
  4: "bg-muted text-muted-foreground",
  5: "bg-red-500/20 text-red-400",
  6: "bg-primary/20 text-primary",
  7: "bg-primary/20 text-primary",
};

const BUY_AD_STATUS_LABELS: Record<number, string> = {
  0: "Active",
  1: "Cancelled",
  2: "Expired",
  3: "Completed",
};

function shortenAddress(a: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}

export default function BuyEscrowAdmin() {
  const { address } = useAccount();
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: owner } = useReadContract({
    address: BUY_ESCROW_ADDRESS,
    abi: BUY_ESCROW_ABI,
    functionName: "owner",
  });

  const { data: nextAdId } = useReadContract({
    address: BUY_ESCROW_ADDRESS,
    abi: BUY_ESCROW_ABI,
    functionName: "nextAdId",
    scopeKey: `buy-admin-${refreshKey}`,
  });
  const { data: nextDealId } = useReadContract({
    address: BUY_ESCROW_ADDRESS,
    abi: BUY_ESCROW_ABI,
    functionName: "nextDealId",
    scopeKey: `buy-admin-${refreshKey}`,
  });
  const { data: accFees } = useReadContract({
    address: BUY_ESCROW_ADDRESS,
    abi: BUY_ESCROW_ABI,
    functionName: "accumulatedFees",
    scopeKey: `buy-admin-${refreshKey}`,
  });
  const { data: sellerFeeBps } = useReadContract({
    address: BUY_ESCROW_ADDRESS,
    abi: BUY_ESCROW_ABI,
    functionName: "sellerFeeBps",
    scopeKey: `buy-admin-${refreshKey}`,
  });
  const { data: buyerFeeBps } = useReadContract({
    address: BUY_ESCROW_ADDRESS,
    abi: BUY_ESCROW_ABI,
    functionName: "buyerFeeBps",
    scopeKey: `buy-admin-${refreshKey}`,
  });
  const { data: feeCollector } = useReadContract({
    address: BUY_ESCROW_ADDRESS,
    abi: BUY_ESCROW_ABI,
    functionName: "feeCollector",
    scopeKey: `buy-admin-${refreshKey}`,
  });

  const adCount = nextAdId ? Number(nextAdId) - 1 : 0;
  const dealCount = nextDealId ? Number(nextDealId) - 1 : 0;
  const feesAmt = accFees ? parseFloat(formatUnits(accFees as bigint, 18)) : 0;

  const isOwner = address && owner && address.toLowerCase() === (owner as string).toLowerCase();

  const { writeContract, data: txHash } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  useEffect(() => {
    if (isSuccess) {
      toast.success("Buy-escrow tx confirmed");
      setRefreshKey((k) => k + 1);
    }
  }, [isSuccess]);

  const resolve = (dealId: number, toBuyer: boolean) => {
    writeContract({
      address: BUY_ESCROW_ADDRESS,
      abi: BUY_ESCROW_ABI,
      functionName: toBuyer ? "adminReleaseToBuyer" : "adminReleaseToSeller",
      args: [BigInt(dealId)],
    } as any);
    toast.info(`Resolving buy-deal #${dealId} → ${toBuyer ? "buyer" : "seller"}…`);
  };

  const withdrawFees = () => {
    if (!accFees || (accFees as bigint) === 0n) return;
    writeContract({
      address: BUY_ESCROW_ADDRESS,
      abi: BUY_ESCROW_ABI,
      functionName: "withdrawFees",
      args: [accFees as bigint],
    } as any);
  };

  return (
    <div className="mt-8 space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Buy Escrow Admin</h2>
          <p className="text-xs text-muted-foreground">Contract: {shortenAddress(BUY_ESCROW_ADDRESS)} · Owner: {shortenAddress(String(owner || ""))}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {!isOwner && (
        <Card className="border-yellow-500/40 bg-yellow-500/5">
          <CardContent className="p-3 text-xs text-yellow-400">
            You are not the Buy Escrow owner — admin actions below will revert on-chain.
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Buy Ads</p><p className="text-2xl font-bold tabular-nums">{adCount}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Buy Deals</p><p className="text-2xl font-bold tabular-nums">{dealCount}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Fees Earned (USDT)</p><p className="text-lg font-bold tabular-nums">{feesAmt.toFixed(4)}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Contract</p>
          <a href={`https://bscscan.com/address/${BUY_ESCROW_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="text-primary text-sm hover:underline flex items-center gap-1">BscScan <ExternalLink className="h-3 w-3" /></a>
        </CardContent></Card>
      </div>

      {/* Fees + Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3"><CardTitle className="text-base">USDT Fees</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Accumulated</p>
              <p className="text-lg font-bold tabular-nums">{feesAmt.toFixed(4)} USDT</p>
              <p className="text-xs text-muted-foreground mt-1">Goes to: {shortenAddress(String(feeCollector || ""))}</p>
            </div>
            <Button size="sm" variant="outline" disabled={!isOwner || feesAmt <= 0} onClick={withdrawFees}>
              Withdraw All
            </Button>
          </CardContent>
        </Card>

        <FeeAndCollectorSettings
          disabled={!isOwner}
          currentSellerBps={Number(sellerFeeBps || 0)}
          currentBuyerBps={Number(buyerFeeBps || 0)}
          currentCollector={String(feeCollector || "")}
          onTx={(fn, args) => writeContract({ address: BUY_ESCROW_ADDRESS, abi: BUY_ESCROW_ABI, functionName: fn, args } as any)}
        />
      </div>

      {/* Deals */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-primary" /> Buy-Escrow Deal Monitor</CardTitle></CardHeader>
        <CardContent>
          {dealCount === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No buy-escrow deals yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead><TableHead>Buyer (Ad)</TableHead><TableHead>Seller</TableHead>
                    <TableHead>USDT</TableHead><TableHead>Rate ₹</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: Math.min(dealCount, 50) }, (_, i) => i + 1).map((id) => (
                    <BuyDealRow key={`${id}-${refreshKey}`} dealId={id} onResolve={resolve} canResolve={!!isOwner} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ads */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3"><CardTitle className="text-base">Buy-Ad Monitor</CardTitle></CardHeader>
        <CardContent>
          {adCount === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No buy ads created yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead><TableHead>Buyer</TableHead><TableHead>Remaining / Total</TableHead>
                    <TableHead>Locked</TableHead><TableHead>Rate ₹</TableHead><TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: Math.min(adCount, 50) }, (_, i) => i + 1).map((id) => (
                    <BuyAdRow key={`${id}-${refreshKey}`} adId={id} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FeeAndCollectorSettings({
  disabled, currentSellerBps, currentBuyerBps, currentCollector, onTx,
}: {
  disabled: boolean;
  currentSellerBps: number;
  currentBuyerBps: number;
  currentCollector: string;
  onTx: (fn: string, args: any[]) => void;
}) {
  const [sellerBps, setSellerBps] = useState("");
  const [buyerBps, setBuyerBps] = useState("");
  const [collector, setCollector] = useState("");

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Settings className="h-4 w-4" /> Fees & Collector</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground">
          Current: seller <span className="font-mono text-foreground">{currentSellerBps} bps</span> · buyer <span className="font-mono text-foreground">{currentBuyerBps} bps</span>
        </div>
        <div className="flex gap-2">
          <Input placeholder={`Seller bps (${currentSellerBps})`} value={sellerBps} onChange={(e) => setSellerBps(e.target.value)} className="h-8 text-sm" />
          <Input placeholder={`Buyer bps (${currentBuyerBps})`} value={buyerBps} onChange={(e) => setBuyerBps(e.target.value)} className="h-8 text-sm" />
          <Button size="sm" disabled={disabled || (!sellerBps && !buyerBps)} onClick={() => {
            const s = sellerBps ? parseInt(sellerBps) : currentSellerBps;
            const b = buyerBps ? parseInt(buyerBps) : currentBuyerBps;
            onTx("setFees", [s, b]);
          }}>Update</Button>
        </div>
        <div className="text-xs text-muted-foreground">Collector: <span className="font-mono">{currentCollector ? shortenAddress(currentCollector) : "—"}</span></div>
        <div className="flex gap-2">
          <Input placeholder="0x... new fee collector" value={collector} onChange={(e) => setCollector(e.target.value)} className="h-8 text-sm font-mono" />
          <Button size="sm" disabled={disabled || !/^0x[a-fA-F0-9]{40}$/.test(collector)} onClick={() => onTx("setFeeCollector", [collector])}>Set</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BuyDealRow({ dealId, onResolve, canResolve }: { dealId: number; onResolve: (id: number, toBuyer: boolean) => void; canResolve: boolean }) {
  const { address } = useAccount();
  const [showChat, setShowChat] = useState(false);

  const { data: deal } = useReadContract({
    address: BUY_ESCROW_ADDRESS,
    abi: BUY_ESCROW_ABI,
    functionName: "getDeal",
    args: [BigInt(dealId)],
  });
  const adId = deal ? Number((deal as any).adId) : undefined;
  const { data: ad } = useReadContract({
    address: BUY_ESCROW_ADDRESS,
    abi: BUY_ESCROW_ABI,
    functionName: "getAd",
    args: adId !== undefined ? [BigInt(adId)] : undefined,
    query: { enabled: adId !== undefined },
  });
  if (!deal || !ad) return null;
  const d = deal as any;
  const a = ad as any;
  const status = Number(d.status);
  const amount = formatUnits(d.amount, 18);
  const rate = formatUnits(a.rateInrPerUsdt, 2);
  const isDisputed = status === 5;
  const isLockedOrPaid = status === 1 || status === 2;

  return (
    <>
      <TableRow className={isDisputed ? "bg-red-500/5" : ""}>
        <TableCell className="font-mono text-xs">#{dealId}</TableCell>
        <TableCell className="font-mono text-xs">{shortenAddress(String(a.buyer))}</TableCell>
        <TableCell className="font-mono text-xs">{shortenAddress(String(d.seller))}</TableCell>
        <TableCell className="tabular-nums">{parseFloat(amount).toFixed(2)}</TableCell>
        <TableCell className="tabular-nums">₹{rate}</TableCell>
        <TableCell>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BUY_DEAL_STATUS_COLORS[status] || ""}`}>
            {BUY_DEAL_STATUS_LABELS[status] || "Unknown"}
          </span>
        </TableCell>
        <TableCell>
          <div className="flex gap-1.5 items-center">
            {isDisputed && (
              <>
                <Button size="sm" variant="buy" className="h-7 text-xs px-2" disabled={!canResolve} onClick={() => onResolve(dealId, true)}>To Buyer</Button>
                <Button size="sm" variant="sell" className="h-7 text-xs px-2" disabled={!canResolve} onClick={() => onResolve(dealId, false)}>To Seller</Button>
              </>
            )}
            {(isLockedOrPaid || isDisputed) && (
              <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-muted-foreground" onClick={() => setShowChat(!showChat)}>
                <MessageSquare className="h-3 w-3 mr-1" /> {showChat ? "Hide" : "Chat"}
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
      {showChat && address && (
        <TableRow>
          <TableCell colSpan={7} className="p-0">
            <div className="h-72 border-t border-border">
              <ChatPanel dealId={dealId + BUY_CHAT_OFFSET} userAddress={address} readOnly={!isDisputed} />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function BuyAdRow({ adId }: { adId: number }) {
  const { data } = useReadContract({
    address: BUY_ESCROW_ADDRESS,
    abi: BUY_ESCROW_ABI,
    functionName: "getAd",
    args: [BigInt(adId)],
  });
  if (!data) return null;
  const a = data as any;
  const status = Number(a.status);
  const remaining = formatUnits(a.remaining, 18);
  const total = formatUnits(a.totalAmount, 18);
  const locked = formatUnits(a.lockedInDeals, 18);
  const rate = formatUnits(a.rateInrPerUsdt, 2);
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">#{adId}</TableCell>
      <TableCell className="font-mono text-xs">{shortenAddress(String(a.buyer))}</TableCell>
      <TableCell className="tabular-nums text-xs">{parseFloat(remaining).toFixed(2)} / {parseFloat(total).toFixed(2)}</TableCell>
      <TableCell className="tabular-nums text-xs">{parseFloat(locked).toFixed(2)}</TableCell>
      <TableCell className="tabular-nums">₹{rate}</TableCell>
      <TableCell>
        <Badge variant="outline" className={`text-[10px] ${status === 0 ? "border-green-500/40 text-green-400" : "border-muted text-muted-foreground"}`}>
          {BUY_AD_STATUS_LABELS[status] || "Unknown"}
        </Badge>
      </TableCell>
    </TableRow>
  );
}
