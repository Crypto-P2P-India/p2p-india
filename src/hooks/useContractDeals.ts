import { useReadContract, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { P2P_CONTRACT_ADDRESS, USDT_ADDRESS } from "@/config/wagmi";
import { P2P_ESCROW_ABI } from "@/config/abi";

const NATIVE_BNB = "0x0000000000000000000000000000000000000000";
const PAY_WINDOW = 15 * 60;
// Seller has CONFIRM_WINDOW after buyer marks paid before buyer can dispute.
// Matches `CONFIRM_WINDOW` constant in SellEscrow.sol (30 minutes).
const CONFIRM_WINDOW = 30 * 60;

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
    .map((res) => Number(((res.result as any).adId ?? (res.result as any)[0]) || 0))
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
      const rawId = d.id !== undefined ? d.id : index + 1;
      const rawAdId = d.adId !== undefined ? d.adId : d[0];
      const rawBuyer = d.buyer || d[1];
      const rawTokenAmount = d.amount !== undefined ? d.amount : d[2];
      const rawCreatedAt = d.createdAt !== undefined ? d.createdAt : d[3];
      const rawPaidAt = d.paidAt !== undefined ? d.paidAt : d[4];
      const rawState = Number(d.state !== undefined ? d.state : d[5]);
      const ad = adsById.get(Number(rawAdId));
      if (!ad) continue;
      const rawSeller = ad.seller || ad[0];
      const tokenAddr = String(ad.token || ad[1]);
      const pricePerToken = ad.pricePerToken !== undefined ? ad.pricePerToken : ad[7];
      const isBNB = tokenAddr.toLowerCase() === NATIVE_BNB.toLowerCase();
      const rawStatus = rawState === 1 ? 0 : rawState === 2 ? 1 : rawState === 3 ? 2 : rawState === 5 ? 4 : 3;
      const rawBuyerConfirmed = rawState === 2 || rawState === 3 || rawState === 5;
      const rawSellerConfirmed = rawState === 3;
      const rawDeadline = BigInt(String(rawCreatedAt || 0)) + BigInt(PAY_WINDOW);

      if (rawId === undefined || rawTokenAmount === undefined) continue;

      // inrAmount = tokenAmount * pricePerToken (no division in contract)
      // tokenAmount has 18 decimals, pricePerToken has 2 decimals → total 20 decimals
      const inrBigInt = BigInt(String(rawTokenAmount)) * BigInt(String(pricePerToken));
      const inrFormatted = parseFloat(formatUnits(inrBigInt, 20)).toFixed(2);

      deals.push({
        dealId: Number(rawId),
        adId: Number(rawAdId),
        buyer: String(rawBuyer),
        seller: String(rawSeller),
        token: String(tokenAddr),
        tokenSymbol: isBNB ? "BNB" : "USDT",
        tokenAmount: formatUnits(BigInt(String(rawTokenAmount)), 18),
        inrAmount: inrFormatted,
        deadline: Number(rawDeadline),
        buyerConfirmed: Boolean(rawBuyerConfirmed),
        sellerConfirmed: Boolean(rawSellerConfirmed),
        status: Number(rawStatus),
      });
    }
  }

  const refetch = () => { refetchDeals(); refetchDealAds(); };
  return { deals, isLoading: loadingCount || loadingDeals || loadingDealAds, refetch };
}
