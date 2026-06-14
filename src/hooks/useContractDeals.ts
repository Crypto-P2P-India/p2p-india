import { useReadContract, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { P2P_CONTRACT_ADDRESS } from "@/config/wagmi";
import { P2P_ESCROW_ABI } from "@/config/abi";

const NATIVE_BNB = "0x0000000000000000000000000000000000000000";
// Seller has CONFIRM_WINDOW after buyer marks paid before buyer can dispute.
const CONFIRM_WINDOW = 30 * 60;
const DEFAULT_PAY_WINDOW = 15 * 60;

export interface LiveDeal {
  dealId: number;
  adId: number;
  buyer: string;
  seller: string;
  token: string;
  tokenSymbol: string;
  tokenAmount: string;
  inrAmount: string;
  /** Active countdown deadline: pay deadline before paid, confirm deadline after paid. */
  deadline: number;
  /** When buyer marked paid (0 if not yet). */
  paidAt: number;
  /** When the deal was created on-chain. */
  createdAt: number;
  buyerConfirmed: boolean;
  sellerConfirmed: boolean;
  status: number;
  /** Ad's base pay window in seconds. */
  payWindow: number;
  /** Extra seconds added via buyer self-extension or accepted seller proposal. */
  payDeadlineOffset: number;
  /** Whether buyer has already used their one self-extension. */
  buyerExtensionUsed: boolean;
  /** Seller's pending extension proposal in seconds (0 = none). */
  sellerProposedExtra: number;
  /** Whether seller's proposed extension has already been used/accepted. */
  sellerExtensionUsed: boolean;
  disputeRaisedBy: string;
}

export function useContractDeals() {
  const { data: nextDealId, isLoading: loadingCount } = useReadContract({
    address: P2P_CONTRACT_ADDRESS,
    abi: P2P_ESCROW_ABI,
    functionName: "nextDealId",
    query: { refetchInterval: 5000 },
  });

  const dealCount = nextDealId ? Number(nextDealId) - 1 : 0;

  const dealCalls = Array.from({ length: Math.max(0, dealCount) }, (_, i) => ({
    address: P2P_CONTRACT_ADDRESS as `0x${string}`,
    abi: P2P_ESCROW_ABI as any,
    functionName: "getDeal" as const,
    args: [BigInt(i + 1)],
  }));

  const { data: dealsData, isLoading: loadingDeals, refetch: refetchDeals } = useReadContracts({
    contracts: dealCalls,
    query: { enabled: dealCount > 0, refetchInterval: 5000 },
  });

  const dealAdIds = dealsData
    ?.filter((res) => res.status === "success" && res.result)
    .map((res) => Number((res.result as any).adId || 0))
    .filter((id, index, arr) => id > 0 && arr.indexOf(id) === index) || [];

  const dealAdCalls = dealAdIds.map((id) => ({
    address: P2P_CONTRACT_ADDRESS as `0x${string}`,
    abi: P2P_ESCROW_ABI as any,
    functionName: "getAd" as const,
    args: [BigInt(id)],
  }));

  const { data: adData, isLoading: loadingDealAds, refetch: refetchDealAds } = useReadContracts({
    contracts: dealAdCalls,
    query: { enabled: dealAdIds.length > 0, refetchInterval: 5000 },
  });

  const adsById = new Map<number, any>();
  adData?.forEach((res, index) => {
    if (res.status === "success" && res.result) adsById.set(dealAdIds[index], res.result as any);
  });

  const deals: LiveDeal[] = [];

  if (dealsData) {
    for (const [index, res] of dealsData.entries()) {
      if (res.status !== "success" || !res.result) continue;
      const d = res.result as any;
      const dealId = index + 1;
      const adId = Number(d.adId);
      const ad = adsById.get(adId);
      if (!ad) continue;

      const buyer = String(d.buyer);
      const seller = String(ad.seller);
      const tokenAddr = String(ad.token);
      const amountRaw = BigInt(String(d.amount ?? 0));
      const pricePerToken = BigInt(String(ad.pricePerToken ?? 0));
      const state = Number(d.state ?? 0);
      const createdAt = Number(d.createdAt ?? 0);
      const paidAt = Number(d.paidAt ?? 0);
      const payDeadlineOffset = Number(d.payDeadlineOffset ?? 0);
      const buyerExtensionUsed = Boolean(d.buyerExtensionUsed);
      const sellerProposedExtra = Number(d.sellerProposedExtra ?? 0);
      const sellerExtensionUsed = Boolean(d.sellerExtensionUsed);
      const disputeRaisedBy = String(d.disputeRaisedBy ?? "0x0000000000000000000000000000000000000000");
      const payWindow = Number(ad.payWindow ?? DEFAULT_PAY_WINDOW);

      // Map contract DealState → app status
      // 0=NONE, 1=LOCKED→0 active, 2=PAID→1, 3=RELEASED→2, 4=REFUNDED→3, 5=DISPUTED→4, 6=RESOLVED→5
      const status =
        state === 1 ? 0 :
        state === 2 ? 1 :
        state === 3 ? 2 :
        state === 4 ? 3 :
        state === 5 ? 4 :
        state === 6 ? 5 : 0;

      const buyerConfirmed = state === 2 || state === 3 || state === 5 || state === 6;
      const sellerConfirmed = state === 3;

      const activeDeadline =
        state === 2 && paidAt > 0
          ? paidAt + CONFIRM_WINDOW
          : createdAt + payWindow + payDeadlineOffset;

      const inrBigInt = amountRaw * pricePerToken;
      const inrFormatted = parseFloat(formatUnits(inrBigInt, 20)).toFixed(2);

      deals.push({
        dealId,
        adId,
        buyer,
        seller,
        token: tokenAddr,
        tokenSymbol: tokenAddr.toLowerCase() === NATIVE_BNB.toLowerCase() ? "BNB" : "USDT",
        tokenAmount: formatUnits(amountRaw, 18),
        inrAmount: inrFormatted,
        deadline: activeDeadline,
        paidAt,
        createdAt,
        buyerConfirmed,
        sellerConfirmed,
        status,
        payWindow,
        payDeadlineOffset,
        buyerExtensionUsed,
        sellerProposedExtra,
        sellerExtensionUsed,
        disputeRaisedBy,
      });
    }
  }

  const refetch = () => { refetchDeals(); refetchDealAds(); };
  return { deals, isLoading: loadingCount || loadingDeals || loadingDealAds, refetch };
}
