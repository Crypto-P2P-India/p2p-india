import { useReadContract, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { BUY_ESCROW_ADDRESS, BUY_ESCROW_ABI } from "@/config/buyEscrowAbi";

export interface LiveBuyAd {
  adId: number;
  buyer: string;
  /** USDT remaining (still unlocked) the buyer wants to receive. */
  remainingUsdt: string;
  /** Total USDT the buyer originally requested. */
  totalUsdt: string;
  /** Locked in deals (sellers already accepted). */
  lockedUsdt: string;
  /** Minimum trade size in USDT. */
  minTradeUsdt: string;
  /** INR rate per USDT (display, 2 decimals). */
  rateInrPerUsdt: string;
  /** Total INR value of remaining USDT. */
  inrTotal: string;
  paymentWindow: number;
  expiresAt: number;
  status: number; // 0 active, 1 closed, 2 expired
  paymentMethod: string;
  name: string;
  upiOrAccount: string;
  bankOrIfsc: string;
  qrRef: string;
  buyerFeeBps: number;
  sellerFeeBps: number;
}

export function useBuyContractAds() {
  const { data: nextAdId, isLoading: loadingCount } = useReadContract({
    address: BUY_ESCROW_ADDRESS,
    abi: BUY_ESCROW_ABI,
    functionName: "nextAdId",
    query: { refetchInterval: 5000 },
  });

  const adCount = nextAdId ? Number(nextAdId) - 1 : 0;

  const adCalls = Array.from({ length: Math.max(0, adCount) }, (_, i) => ({
    address: BUY_ESCROW_ADDRESS as `0x${string}`,
    abi: BUY_ESCROW_ABI as any,
    functionName: "getAd" as const,
    args: [BigInt(i + 1)],
  }));

  const { data: adsData, isLoading: loadingAds, refetch } = useReadContracts({
    contracts: adCalls,
    query: { enabled: adCount > 0, refetchInterval: 5000 },
  });

  const ads: LiveBuyAd[] = [];
  const nowSec = Math.floor(Date.now() / 1000);

  if (adsData) {
    for (const [index, res] of adsData.entries()) {
      if (res.status !== "success" || !res.result) continue;
      const a = res.result as any;
      const total = BigInt(String(a.totalAmount ?? 0));
      const remaining = BigInt(String(a.remaining ?? 0));
      const locked = BigInt(String(a.lockedInDeals ?? 0));
      const minTrade = BigInt(String(a.minTrade ?? 0));
      const rate = BigInt(String(a.rateInrPerUsdt ?? 0)); // 2 decimals
      const expiresAt = Number(a.expiresAt ?? 0);
      const statusEnum = Number(a.status ?? 0); // 0 Active, 1 Closed
      const isExpired = expiresAt > 0 && expiresAt < nowSec;
      const status = statusEnum === 1 ? 1 : isExpired ? 2 : 0;

      // INR = remaining (18dp) * rate (2dp) → 20dp → format then parse
      const inrRaw = remaining * rate;
      ads.push({
        adId: index + 1,
        buyer: String(a.buyer),
        remainingUsdt: formatUnits(remaining, 18),
        totalUsdt: formatUnits(total, 18),
        lockedUsdt: formatUnits(locked, 18),
        minTradeUsdt: formatUnits(minTrade, 18),
        rateInrPerUsdt: formatUnits(rate, 2),
        inrTotal: parseFloat(formatUnits(inrRaw, 20)).toFixed(2),
        paymentWindow: Number(a.paymentWindow ?? 900),
        expiresAt,
        status,
        paymentMethod: String(a.paymentMethod ?? ""),
        name: String(a.name ?? ""),
        upiOrAccount: String(a.upiOrAccount ?? ""),
        bankOrIfsc: String(a.bankOrIfsc ?? ""),
        qrRef: String(a.qrRef ?? ""),
        buyerFeeBps: Number(a.buyerFeeBpsSnap ?? 0),
        sellerFeeBps: Number(a.sellerFeeBpsSnap ?? 0),
      });
    }
  }

  return { ads, isLoading: loadingCount || loadingAds, refetch: () => { refetch(); } };
}
