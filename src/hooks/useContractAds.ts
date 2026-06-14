import { useReadContract, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { P2P_CONTRACT_ADDRESS, USDT_ADDRESS } from "@/config/wagmi";
import { P2P_ESCROW_ABI } from "@/config/abi";

const NATIVE_BNB = "0x0000000000000000000000000000000000000000";
const NO_AD_EXPIRY = 9_999_999_999;
const DEFAULT_DEAL_TIMEOUT = 15 * 60;

export interface LiveAd {
  adId: number;
  seller: string;
  token: string;
  tokenSymbol: string;
  /** Unsold amount still available for new buyers. */
  tokenAmount: string;
  /** Total amount the seller originally posted. */
  totalAmount: string;
  /** Amount currently locked in pending deals. */
  lockedAmount: string;
  /** Minimum amount a buyer must take in a single deal. */
  minFillAmount: string;
  pricePerToken: string;
  /** INR value of the currently-available amount. */
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
    for (const [index, res] of adsData.entries()) {
      if (res.status !== "success" || !res.result) continue;
      const ad = res.result as any;

      const id = index + 1;
      const seller = ad.seller || ad[0];
      const tokenAddr = ad.token || ad[1];
      const totalAmountRaw = ad.totalAmount !== undefined ? ad.totalAmount : ad[2];
      const remainingRaw = ad.remainingAmount !== undefined ? ad.remainingAmount : ad[3];
      const lockedRaw = ad.lockedInDeals !== undefined ? ad.lockedInDeals : ad[4];
      const minFillRaw = ad.minFillAmount !== undefined ? ad.minFillAmount : ad[6];
      const pricePerToken = ad.pricePerToken !== undefined ? ad.pricePerToken : ad[7];
      const paymentInfo = ad.paymentMethod !== undefined ? ad.paymentMethod : ad[8];
      const active = ad.active !== undefined ? ad.active : ad[9];

      if (remainingRaw === undefined) continue;

      const remaining = BigInt(String(remainingRaw));
      const locked = BigInt(String(lockedRaw || 0));
      const minFill = BigInt(String(minFillRaw || 0));
      // Contract already decrements `remainingAmount` when a deal is taken,
      // so `remaining` IS the unsold amount still available for new buyers.
      const available = remaining;

      const hasSellableRemaining = available > 0n && (minFill === 0n || available >= minFill);
      const status = active ? (hasSellableRemaining ? 0 : locked > 0n ? 1 : 0) : 3;

      const isBNB = String(tokenAddr).toLowerCase() === NATIVE_BNB.toLowerCase();
      const tokenSymbol = isBNB ? "BNB" : "USDT";

      const availableFormatted = formatUnits(available, 18);
      const totalFormatted = formatUnits(BigInt(String(totalAmountRaw || remaining)), 18);
      const lockedFormatted = formatUnits(locked, 18);
      const minFillFormatted = formatUnits(minFill, 18);
      const priceFormatted = formatUnits(BigInt(String(pricePerToken)), 2);
      const rawInrTotal = available * BigInt(String(pricePerToken));
      const inrTotal = parseFloat(formatUnits(rawInrTotal, 20)).toFixed(2);

      ads.push({
        adId: id,
        seller: String(seller),
        token: String(tokenAddr),
        tokenSymbol,
        tokenAmount: availableFormatted,
        totalAmount: totalFormatted,
        lockedAmount: lockedFormatted,
        minFillAmount: minFillFormatted,
        pricePerToken: priceFormatted,
        inrTotal,
        dealTimeout: DEFAULT_DEAL_TIMEOUT,
        adExpiry: NO_AD_EXPIRY,
        paymentInfo: String(paymentInfo),
        status: Number(status),
      });
    }
  }

  const refetch = () => { refetchAds(); };
  return { ads, isLoading: loadingCount || loadingAds, refetch };
}
