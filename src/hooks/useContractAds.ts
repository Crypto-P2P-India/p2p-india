import { useReadContract, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { P2P_CONTRACT_ADDRESS, USDT_ADDRESS } from "@/config/wagmi";
import { P2P_ESCROW_ABI } from "@/config/abi";

const NATIVE_BNB = "0x0000000000000000000000000000000000000000";

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
  /** Buyer's pay window in seconds (15m or 30m). */
  dealTimeout: number;
  /** Ad expiry unix timestamp. */
  adExpiry: number;
  /** Ad creation unix timestamp. */
  createdAt: number;
  paymentInfo: string;
  status: number;
  sellerFeeBps: number;
  buyerFeeBps: number;
  feeReserve: string;
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
  const nowSec = Math.floor(Date.now() / 1000);

  if (adsData) {
    for (const [index, res] of adsData.entries()) {
      if (res.status !== "success" || !res.result) continue;
      const ad = res.result as any;

      const id = index + 1;
      const seller = String(ad.seller);
      const tokenAddr = String(ad.token);
      const remaining = BigInt(String(ad.remainingAmount ?? 0));
      const total = BigInt(String(ad.totalAmount ?? remaining));
      const locked = BigInt(String(ad.lockedInDeals ?? 0));
      const minFill = BigInt(String(ad.minFillAmount ?? 0));
      const pricePerToken = BigInt(String(ad.pricePerToken ?? 0));
      const paymentInfo = String(ad.paymentMethod ?? "");
      const active = Boolean(ad.active);
      const payWindow = Number(ad.payWindow ?? 900);
      const expiresAt = Number(ad.expiresAt ?? 0);
      const createdAt = Number(ad.createdAt ?? 0);
      const sellerFeeBps = Number(ad.sellerFeeBpsSnapshot ?? 0);
      const buyerFeeBps = Number(ad.buyerFeeBpsSnapshot ?? 0);
      const feeReserve = BigInt(String(ad.feeReserve ?? 0));

      const available = remaining;
      const hasSellableRemaining = available > 0n && (minFill === 0n || available >= minFill);
      const isExpired = expiresAt > 0 && expiresAt < nowSec;
      // Status: 0 live, 1 in-deal, 3 cancelled, 4 expired
      const status = !active
        ? 3
        : isExpired
        ? 4
        : hasSellableRemaining
        ? 0
        : locked > 0n
        ? 1
        : 0;

      const isBNB = tokenAddr.toLowerCase() === NATIVE_BNB.toLowerCase();
      const rawInrTotal = available * pricePerToken;

      ads.push({
        adId: id,
        seller,
        token: tokenAddr,
        tokenSymbol: isBNB ? "BNB" : "USDT",
        tokenAmount: formatUnits(available, 18),
        totalAmount: formatUnits(total, 18),
        lockedAmount: formatUnits(locked, 18),
        minFillAmount: formatUnits(minFill, 18),
        pricePerToken: formatUnits(pricePerToken, 2),
        inrTotal: parseFloat(formatUnits(rawInrTotal, 20)).toFixed(2),
        dealTimeout: payWindow,
        adExpiry: expiresAt || 9_999_999_999,
        createdAt,
        paymentInfo,
        status,
        sellerFeeBps,
        buyerFeeBps,
        feeReserve: formatUnits(feeReserve, 18),
      });
    }
  }

  const refetch = () => { refetchAds(); };
  return { ads, isLoading: loadingCount || loadingAds, refetch };
}
