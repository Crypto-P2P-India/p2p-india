import { useReadContract, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { P2P_CONTRACT_ADDRESS, USDT_ADDRESS } from "@/config/wagmi";
import { P2P_ESCROW_ABI } from "@/config/abi";

const NATIVE_BNB = "0x0000000000000000000000000000000000000000";
const DEFAULT_AD_DURATION = 72 * 60 * 60;
const DEFAULT_DEAL_TIMEOUT = 15 * 60;

export interface LiveAd {
  adId: number;
  seller: string;
  token: string;
  tokenSymbol: string;
  tokenAmount: string;
  pricePerToken: string;
  inrTotal: string;
  dealTimeout: number;
  adExpiry: number;
  paymentInfo: string;
  status: number;
}

export function useContractAds() {
  const { data: nextAdId, isLoading: loadingCount } = useReadContract({
    address: P2P_CONTRACT_ADDRESS,
    abi: P2P_ESCROW_ABI,
    functionName: "nextAdId",
    query: { refetchInterval: 5000 },
  });

  // nextAdId is the next ID to assign, so existing ads are 1..(nextAdId-1)
  const adCount = nextAdId ? Number(nextAdId) - 1 : 0;

  const adCalls = Array.from({ length: Math.max(0, adCount) }, (_, i) => ({
    address: P2P_CONTRACT_ADDRESS as `0x${string}`,
    abi: P2P_ESCROW_ABI as any,
    functionName: "getAd" as const,
    args: [BigInt(i + 1)],
  }));

  const { data: adsData, isLoading: loadingAds, refetch: refetchAds } = useReadContracts({
    contracts: adCalls,
    query: { enabled: adCount > 0, refetchInterval: 5000 },
  });

  const ads: LiveAd[] = [];

  if (adsData) {
    for (const res of adsData) {
      if (res.status !== "success" || !res.result) continue;
      const ad = res.result as any;

      const id = ad.id !== undefined ? ad.id : ad[0];
      const seller = ad.seller || ad[0];
      const tokenAddr = ad.token || ad[1];
      const tokenAmount = ad.remainingAmount !== undefined ? ad.remainingAmount : ad[3];
      const lockedInDeals = ad.lockedInDeals !== undefined ? ad.lockedInDeals : ad[4];
      const pricePerToken = ad.pricePerToken !== undefined ? ad.pricePerToken : ad[7];
      const paymentInfo = ad.paymentMethod !== undefined ? ad.paymentMethod : ad[8];
      const active = ad.active !== undefined ? ad.active : ad[9];
      const createdAt = ad.createdAt !== undefined ? ad.createdAt : ad[10];
      const status = active ? (BigInt(String(lockedInDeals || 0)) > 0n ? 1 : 0) : 3;
      const adExpiry = Number(createdAt || 0) + DEFAULT_AD_DURATION;

      if (id === undefined || tokenAmount === undefined) continue;

      const isBNB = String(tokenAddr).toLowerCase() === NATIVE_BNB.toLowerCase();
      const tokenSymbol = isBNB ? "BNB" : "USDT";
      const amountFormatted = formatUnits(BigInt(String(tokenAmount)), 18);
      const priceFormatted = formatUnits(BigInt(String(pricePerToken)), 2);
      // inrTotal = tokenAmount * pricePerToken, both raw → combined 20 decimals
      const rawInrTotal = BigInt(String(tokenAmount)) * BigInt(String(pricePerToken));
      const inrTotal = parseFloat(formatUnits(rawInrTotal, 20)).toFixed(2);

      ads.push({
        adId: Number(id),
        seller: String(seller),
        token: String(tokenAddr),
        tokenSymbol,
        tokenAmount: amountFormatted,
        pricePerToken: priceFormatted,
        inrTotal,
        dealTimeout: DEFAULT_DEAL_TIMEOUT,
        adExpiry: Number(adExpiry),
        paymentInfo: String(paymentInfo),
        status: Number(status),
      });
    }
  }

  const refetch = () => { refetchAds(); };
  return { ads, isLoading: loadingCount || loadingAds, refetch };
}
