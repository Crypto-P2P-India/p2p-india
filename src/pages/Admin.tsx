import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Shield, AlertTriangle, CheckCircle, XCircle, ArrowLeft, RefreshCw, ExternalLink, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { P2P_ESCROW_ABI } from "@/config/abi";
import { P2P_CONTRACT_ADDRESS, USDT_ADDRESS } from "@/config/wagmi";
import { formatUnits } from "viem";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import ChatPanel from "@/components/ChatPanel";
import { cleanupDealAttachments } from "@/lib/dealCleanup";
import DeployContractCard from "@/components/DeployContractCard";

const DEAL_STATUS_LABELS: Record<number, string> = {
  0: "Active",
  1: "Buyer Confirmed",
  2: "Completed",
  3: "Cancelled",
  4: "Disputed",
  5: "Resolved",
};

const DEAL_STATUS_COLORS: Record<number, string> = {
  0: "bg-blue-500/20 text-blue-400",
  1: "bg-yellow-500/20 text-yellow-400",
  2: "bg-green-500/20 text-green-400",
  3: "bg-muted text-muted-foreground",
  4: "bg-red-500/20 text-red-400",
  5: "bg-primary/20 text-primary",
};

const AD_STATUS_LABELS: Record<number, string> = {
  0: "Live",
  1: "In Deal",
  2: "Completed",
  3: "Cancelled",
};

function shortenAddress(addr: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
}

const Admin = () => {
  const { address } = useAccount();
  const [refreshKey, setRefreshKey] = useState(0);

  // Check contract owner
  const { data: contractOwner } = useReadContract({
    address: P2P_CONTRACT_ADDRESS,
    abi: P2P_ESCROW_ABI,
    functionName: "owner",
  });

const ADMIN_ALLOWLIST = ["0xa88798d834453f59f0797409342a95c79642cbea"];
  const isAllowlisted = address && ADMIN_ALLOWLIST.includes(address.toLowerCase());
  const isOwner = isAllowlisted || (address && contractOwner && address.toLowerCase() === (contractOwner as string).toLowerCase());

  // Read counters
  const { data: nextAdId } = useReadContract({
    address: P2P_CONTRACT_ADDRESS,
    abi: P2P_ESCROW_ABI,
    functionName: "nextAdId",
    scopeKey: `admin-${refreshKey}`,
  });

  const { data: nextDealId } = useReadContract({
    address: P2P_CONTRACT_ADDRESS,
    abi: P2P_ESCROW_ABI,
    functionName: "nextDealId",
    scopeKey: `admin-${refreshKey}`,
  });

  const adCount = nextAdId ? Number(nextAdId) - 1 : 0;
  const dealCount = nextDealId ? Number(nextDealId) - 1 : 0;

  // Fetch all deals
  const [allDeals, setAllDeals] = useState<any[]>([]);
  const [allAds, setAllAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // We'll do manual multicall-style fetching
  useEffect(() => {
    if (!adCount && !dealCount) return;
    // Ads and deals will be fetched via individual reads below
  }, [adCount, dealCount, refreshKey]);

  // Resolve dispute
  const { writeContract, data: txHash } = useWriteContract();
  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (txConfirmed) {
      toast.success("Transaction confirmed!");
      setRefreshKey((k) => k + 1);
      // Cleanup attachments for resolved deals
    }
  }, [txConfirmed]);

  const handleResolve = (dealId: number, toSeller: boolean) => {
    writeContract({
      address: P2P_CONTRACT_ADDRESS,
      abi: P2P_ESCROW_ABI,
      functionName: toSeller ? "adminRefundToSeller" : "adminReleaseToBuyer",
      args: [BigInt(dealId)],
    } as any);
    toast.info(`Resolving deal #${dealId} — ${toSeller ? "releasing to seller" : "releasing to buyer"}…`);
  };

  if (!address) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-32">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Connect your wallet to access admin panel</p>
        </div>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-2xl px-4 py-8">
          <div className="flex flex-col items-center text-center mb-6">
            <XCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-foreground font-semibold mb-1">Not the current contract owner</p>
            <p className="text-muted-foreground text-sm">
              You can still deploy a new escrow contract below.
            </p>
            <p className="text-muted-foreground text-xs mt-2">
              Connected: {shortenAddress(address)}
            </p>
          </div>
          <DeployContractCard />
          <div className="flex justify-center">
            <Link to="/">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Trading
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-up">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Admin Dashboard</h1>
              <p className="text-xs text-muted-foreground">Contract: {shortenAddress(P2P_CONTRACT_ADDRESS)}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>

        <DeployContractCard />

        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-4 mb-8 sm:grid-cols-4 animate-fade-up" style={{ animationDelay: "100ms" }}>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Ads</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{adCount}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Deals</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{dealCount}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Contract</p>
              <a
                href={`https://bscscan.com/address/${P2P_CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary text-sm hover:underline flex items-center gap-1"
              >
                BscScan <ExternalLink className="h-3 w-3" />
              </a>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Owner</p>
              <p className="text-sm text-foreground font-mono">{shortenAddress(address)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Deal scanner */}
        <div className="animate-fade-up" style={{ animationDelay: "200ms" }}>
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-primary" />
                Deal Monitor
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dealCount === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No deals yet. Deals will appear here once users start trading.
                </p>
              ) : (
                <DealTable
                  dealCount={dealCount}
                  refreshKey={refreshKey}
                  onResolve={handleResolve}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Ad scanner */}
        <div className="mt-6 animate-fade-up" style={{ animationDelay: "300ms" }}>
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ad Monitor</CardTitle>
            </CardHeader>
            <CardContent>
              {adCount === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No ads created yet.
                </p>
              ) : (
                <AdTable adCount={adCount} refreshKey={refreshKey} />
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

// ── Deal Table Component ──
function DealTable({ dealCount, refreshKey, onResolve }: { dealCount: number; refreshKey: number; onResolve: (id: number, toSeller: boolean) => void }) {
  const dealIds = Array.from({ length: Math.min(dealCount, 50) }, (_, i) => i + 1);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Buyer</TableHead>
            <TableHead>Seller</TableHead>
            <TableHead>Token</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>INR</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Proofs</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dealIds.map((id) => (
            <DealRow key={`${id}-${refreshKey}`} dealId={id} onResolve={onResolve} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DealRow({ dealId, onResolve }: { dealId: number; onResolve: (id: number, toSeller: boolean) => void }) {
  const [showChat, setShowChat] = useState(false);
  const { address } = useAccount();

  const { data } = useReadContract({
    address: P2P_CONTRACT_ADDRESS,
    abi: P2P_ESCROW_ABI,
    functionName: "getDeal",
    args: [BigInt(dealId)],
  });

  const deal = data as any;
  const adId = deal?.adId !== undefined ? deal.adId : deal?.[0];
  const { data: adData } = useReadContract({
    address: P2P_CONTRACT_ADDRESS,
    abi: P2P_ESCROW_ABI,
    functionName: "getAd",
    args: adId !== undefined ? [BigInt(String(adId))] : undefined,
    query: { enabled: adId !== undefined },
  });

  if (!data || !adData) return null;

  const ad = adData as any;
  const rawState = Number(deal.state !== undefined ? deal.state : deal[5]);
  const status = rawState === 1 ? 0 : rawState === 2 ? 1 : rawState === 3 ? 2 : rawState === 5 ? 4 : 3;
  const NATIVE_BNB = "0x0000000000000000000000000000000000000000";
  const tokenAddress = String(ad.token || ad[1]);
  const token = tokenAddress.toLowerCase() === NATIVE_BNB.toLowerCase() ? "BNB" : "USDT";
  const rawAmount = deal.amount !== undefined ? deal.amount : deal[2];
  const amount = formatUnits(rawAmount, 18);
  const pricePerToken = ad.pricePerToken !== undefined ? ad.pricePerToken : ad[7];
  const inr = formatUnits(BigInt(String(rawAmount)) * BigInt(String(pricePerToken)), 20);
  const isDisputed = status === 4;
  const buyer = String(deal.buyer || deal[1]);
  const seller = String(ad.seller || ad[0]);
  const hasBuyerProof = false;
  const hasSellerProof = false;

  return (
    <>
      <TableRow className={isDisputed ? "bg-red-500/5" : ""}>
        <TableCell className="font-mono text-xs">#{dealId}</TableCell>
        <TableCell className="font-mono text-xs">{shortenAddress(buyer)}</TableCell>
        <TableCell className="font-mono text-xs">{shortenAddress(seller)}</TableCell>
        <TableCell>{token}</TableCell>
        <TableCell className="tabular-nums">{parseFloat(amount).toFixed(4)}</TableCell>
        <TableCell className="tabular-nums">₹{parseFloat(inr).toFixed(2)}</TableCell>
        <TableCell>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${DEAL_STATUS_COLORS[status] || ""}`}>
            {DEAL_STATUS_LABELS[status] || "Unknown"}
          </span>
        </TableCell>
        <TableCell>
          <div className="flex gap-1">
            {hasBuyerProof && (
              <Badge variant="outline" className="text-[10px] px-1.5">
                Buyer ✓
              </Badge>
            )}
            {hasSellerProof && (
              <Badge variant="outline" className="text-[10px] px-1.5">
                Seller ✓
              </Badge>
            )}
            {!hasBuyerProof && !hasSellerProof && (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex gap-1.5 items-center">
            {isDisputed && (
              <>
                <Button
                  size="sm"
                  variant="buy"
                  className="h-7 text-xs px-2"
                  onClick={() => onResolve(dealId, false)}
                >
                  Release to Buyer
                </Button>
                <Button
                  size="sm"
                  variant="sell"
                  className="h-7 text-xs px-2"
                  onClick={() => onResolve(dealId, true)}
                >
                  Release to Seller
                </Button>
              </>
            )}
            {/* Chat button for active/disputed deals */}
            {(status === 0 || status === 1 || status === 4) && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs px-2 text-muted-foreground"
                onClick={() => setShowChat(!showChat)}
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                {showChat ? "Hide" : "Chat"}
              </Button>
            )}
            {!isDisputed && status !== 0 && status !== 1 && (
              <span className="text-xs text-muted-foreground">
                {status === 5 ? "Resolved" : status >= 2 ? "Closed" : ""}
              </span>
            )}
          </div>
        </TableCell>
      </TableRow>
      {showChat && address && (
        <TableRow>
          <TableCell colSpan={9} className="p-0">
            <div className="h-72 border-t border-border">
              <ChatPanel dealId={dealId} userAddress={address} readOnly />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ── Ad Table Component ──
function AdTable({ adCount, refreshKey }: { adCount: number; refreshKey: number }) {
  const adIds = Array.from({ length: Math.min(adCount, 50) }, (_, i) => i + 1);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Seller</TableHead>
            <TableHead>Token</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Price/Token (INR)</TableHead>
            <TableHead>Timeout</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {adIds.map((id) => (
            <AdRow key={`${id}-${refreshKey}`} adId={id} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AdRow({ adId }: { adId: number }) {
  const { data } = useReadContract({
    address: P2P_CONTRACT_ADDRESS,
    abi: P2P_ESCROW_ABI,
    functionName: "getAd",
    args: [BigInt(adId)],
  });

  if (!data) return null;

  const ad = data as any;
  const active = Boolean(ad.active !== undefined ? ad.active : ad[9]);
  const status = active ? 0 : 3;
  const NATIVE_BNB = "0x0000000000000000000000000000000000000000";
  const token = String(ad.token || ad[1]).toLowerCase() === NATIVE_BNB.toLowerCase() ? "BNB" : "USDT";
  const amount = formatUnits(ad.remainingAmount !== undefined ? ad.remainingAmount : ad[3], 18);
  const price = formatUnits(ad.pricePerToken !== undefined ? ad.pricePerToken : ad[7], 2);
  const timeoutMin = 15;

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">#{adId}</TableCell>
      <TableCell className="font-mono text-xs">{shortenAddress(String(ad.seller || ad[0]))}</TableCell>
      <TableCell>{token}</TableCell>
      <TableCell className="tabular-nums">{parseFloat(amount).toFixed(4)}</TableCell>
      <TableCell className="tabular-nums">₹{price}</TableCell>
      <TableCell>{timeoutMin}m</TableCell>
      <TableCell>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          status === 0 ? "bg-green-500/20 text-green-400" :
          status === 1 ? "bg-yellow-500/20 text-yellow-400" :
          status === 2 ? "bg-blue-500/20 text-blue-400" :
          "bg-muted text-muted-foreground"
        }`}>
          {AD_STATUS_LABELS[status] || "Unknown"}
        </span>
      </TableCell>
    </TableRow>
  );
}

export default Admin;
