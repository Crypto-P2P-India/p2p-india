import { useReadContract, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { BUY_ESCROW_ADDRESS, BUY_ESCROW_ABI } from "@/config/buyEscrowAbi";

// Offset to namespace buy-deal chat from sell-deal chat in shared `deal_messages` table.
export const BUY_CHAT_OFFSET = 1_000_000;

export interface LiveBuyDeal {
  dealId: number;
  adId: number;
  buyer: string;
  seller: string;
  /** USDT amount locked by seller. */
  amountUsdt: string;
  /** INR amount buyer must pay off-chain. */
  inrAmount: string;
  rateInrPerUsdt: string;
  acceptedAt: number;
  paymentDeadline: number;
  markedPaidAt: number;
  /** App-facing status: 0 active(seller locked), 1 buyer paid, 2 released/done, 3 reclaimed, 4 disputed, 5 resolved-to-buyer, 6 resolved-to-seller */
  status: number;
  sellerExtUsed: boolean;
  buyerExtRequested: boolean;
  buyerExtAmount: number;
  buyerExtApproved: boolean;
  // From parent ad — payment details (so seller can verify, buyer can show)
  paymentMethod: string;
  name: string;
  upiOrAccount: string;
  bankOrIfsc: string;
  qrRef: string;
  paymentWindow: number;
}

export function useBuyContractDeals() {
  const { data: nextDealId, isLoading: loadingCount } = useReadContract({
    address: BUY_ESCROW_ADDRESS,
    abi: BUY_ESCROW_ABI,
    functionName: "nextDealId",
    query: { refetchInterval: 5000 },
  });

  const dealCount = nextDealId ? Number(nextDealId) - 1 : 0;

  const dealCalls = Array.from({ length: Math.max(0, dealCount) }, (_, i) => ({
    address: BUY_ESCROW_ADDRESS as `0x${string}`,
    abi: BUY_ESCROW_ABI as any,
    functionName: "getDeal" as const,
    args: [BigInt(i + 1)],
  }));

  const { data: dealsData, isLoading: loadingDeals, refetch: refetchDeals } = useReadContracts({
    contracts: dealCalls,
    query: { enabled: dealCount > 0, refetchInterval: 5000 },
  });

  const adIds = dealsData
    ?.filter((r) => r.status === "success" && r.result)
    .map((r) => Number((r.result as any).adId || 0))
    .filter((id, i, arr) => id > 0 && arr.indexOf(id) === i) || [];

  const adCalls = adIds.map((id) => ({
    address: BUY_ESCROW_ADDRESS as `0x${string}`,
    abi: BUY_ESCROW_ABI as any,
    functionName: "getAd" as const,
    args: [BigInt(id)],
  }));

  const { data: adData, refetch: refetchAds } = useReadContracts({
    contracts: adCalls,
    query: { enabled: adIds.length > 0, refetchInterval: 5000 },
  });

  const adsById = new Map<number, any>();
  adData?.forEach((r, i) => {
    if (r.status === "success" && r.result) adsById.set(adIds[i], r.result as any);
  });

  const deals: LiveBuyDeal[] = [];

  if (dealsData) {
    for (const [i, res] of dealsData.entries()) {
      if (res.status !== "success" || !res.result) continue;
      const d = res.result as any;
      const adId = Number(d.adId);
      const ad = adsById.get(adId);
      if (!ad) continue;

      const amount = BigInt(String(d.amount ?? 0));
      const rate = BigInt(String(ad.rateInrPerUsdt ?? 0));
      const stateEnum = Number(d.status ?? 0);
      // Contract DealStatus enum (BuyEscrowV1): 0 Pending, 1 Paid, 2 Released, 3 Cancelled, 4 Disputed, 5 ResolvedToBuyer, 6 ResolvedToSeller
      // App-facing status (1:1): 0 active/locked, 1 buyer-paid, 2 completed, 3 reclaimed, 4 disputed, 5 resolved→buyer, 6 resolved→seller
      const status = stateEnum;

      const inrRaw = amount * rate;
      deals.push({
        dealId: i + 1,
        adId,
        buyer: String(ad.buyer),
        seller: String(d.seller),
        amountUsdt: formatUnits(amount, 18),
        inrAmount: parseFloat(formatUnits(inrRaw, 20)).toFixed(2),
        rateInrPerUsdt: formatUnits(rate, 2),
        acceptedAt: Number(d.acceptedAt ?? 0),
        paymentDeadline: Number(d.paymentDeadline ?? 0),
        markedPaidAt: Number(d.markedPaidAt ?? 0),
        status,
        sellerExtUsed: Boolean(d.sellerExtUsed),
        buyerExtRequested: Boolean(d.buyerExtRequested),
        buyerExtAmount: Number(d.buyerExtAmount ?? 0),
        buyerExtApproved: Boolean(d.buyerExtApproved),
        paymentMethod: String(ad.paymentMethod ?? ""),
        name: String(ad.name ?? ""),
        upiOrAccount: String(ad.upiOrAccount ?? ""),
        bankOrIfsc: String(ad.bankOrIfsc ?? ""),
        qrRef: String(ad.qrRef ?? ""),
        paymentWindow: Number(ad.paymentWindow ?? 900),
      });
    }
  }

  return {
    deals,
    isLoading: loadingCount || loadingDeals,
    refetch: () => { refetchDeals(); refetchAds(); },
  };
}
