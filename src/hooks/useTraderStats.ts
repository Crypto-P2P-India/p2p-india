import { useMemo } from "react";
import { useContractAds } from "@/hooks/useContractAds";
import { useContractDeals } from "@/hooks/useContractDeals";
import { useBuyContractAds } from "@/hooks/useBuyContractAds";
import { useBuyContractDeals } from "@/hooks/useBuyContractDeals";

export interface TraderStats {
  sellAdsTotal: number;
  sellAdsCompleted: number;
  sellAdsCancelled: number;
  sellAdsExpired: number;

  buyAdsTotal: number;
  buyAdsActive: number;
  buyAdsClosed: number;
  buyAdsExpired: number;

  dealsCompleted: number;
  dealsCancelled: number;
  dealsDisputed: number;

  usdtBought: number; // USDT user has acquired (as buyer side, RELEASED only)
  usdtSold: number;   // USDT user has sold (as seller side, RELEASED only)
  bnbBought: number;
  bnbSold: number;

  rankBuy: number | null;        // 1-based, by usdtBought
  rankSell: number | null;       // 1-based, by usdtSold
  rankOverall: number | null;    // 1-based, by (usdtBought + usdtSold)
  totalTraders: number;          // unique wallets that have traded
}

const lc = (s: string) => s.toLowerCase();

/**
 * Aggregates the connected wallet's on-chain trading stats across sell-escrow
 * + buy-escrow ads & deals and ranks them against every other trader on the platform.
 */
export function useTraderStats(address?: string): { stats: TraderStats | null; isLoading: boolean } {
  const { ads: sellAds, isLoading: l1 } = useContractAds();
  const { deals: sellDeals } = useContractDeals();
  const { ads: buyAds, isLoading: l2 } = useBuyContractAds();
  const { deals: buyDeals } = useBuyContractDeals();

  const isLoading = l1 || l2;

  const stats = useMemo<TraderStats | null>(() => {
    if (!address) return null;
    const me = lc(address);

    // ─── My ads / deals counters ──────────────────────────────────────────
    const mySellAds = sellAds.filter((a) => lc(a.seller) === me);
    const myBuyAds = buyAds.filter((a) => lc(a.buyer) === me);
    const myAllDeals = [
      ...sellDeals.filter((d) => lc(d.seller) === me || lc(d.buyer) === me),
      ...buyDeals.filter((d) => lc(d.seller) === me || lc(d.buyer) === me),
    ];

    const dealsCompleted = myAllDeals.filter((d) => d.status === 2 || d.status === 5).length;
    const dealsCancelled = myAllDeals.filter((d) => d.status === 3).length;
    const dealsDisputed = myAllDeals.filter((d) => d.status === 4).length;

    // ─── Per-wallet volume aggregation (across ALL traders) ───────────────
    const buyVol = new Map<string, { usdt: number; bnb: number }>();
    const sellVol = new Map<string, { usdt: number; bnb: number }>();

    const addVol = (m: Map<string, { usdt: number; bnb: number }>, w: string, sym: string, amt: number) => {
      const k = lc(w);
      const cur = m.get(k) || { usdt: 0, bnb: 0 };
      if (sym === "USDT") cur.usdt += amt;
      else if (sym === "BNB") cur.bnb += amt;
      m.set(k, cur);
    };

    // Sell-escrow deals: seller sells token to buyer when RELEASED (status 2)
    for (const d of sellDeals) {
      if (d.status !== 2 && d.status !== 5) continue;
      const amt = parseFloat(d.tokenAmount) || 0;
      addVol(sellVol, d.seller, d.tokenSymbol, amt);
      addVol(buyVol, d.buyer, d.tokenSymbol, amt);
    }
    // Buy-escrow deals: seller locks USDT, buyer pays INR. Token is always USDT here.
    for (const d of buyDeals) {
      if (d.status !== 2 && d.status !== 5) continue;
      const amt = parseFloat(d.usdtAmount) || 0;
      addVol(sellVol, d.seller, "USDT", amt);
      addVol(buyVol, d.buyer, "USDT", amt);
    }

    // Collect ALL participating wallets (from ads + deals)
    const wallets = new Set<string>();
    sellAds.forEach((a) => wallets.add(lc(a.seller)));
    buyAds.forEach((a) => wallets.add(lc(a.buyer)));
    sellDeals.forEach((d) => { wallets.add(lc(d.seller)); wallets.add(lc(d.buyer)); });
    buyDeals.forEach((d) => { wallets.add(lc(d.seller)); wallets.add(lc(d.buyer)); });

    const totalTraders = wallets.size;

    // ─── Rankings ─────────────────────────────────────────────────────────
    const buyRanked = [...wallets]
      .map((w) => ({ w, v: (buyVol.get(w)?.usdt || 0) }))
      .sort((a, b) => b.v - a.v);
    const sellRanked = [...wallets]
      .map((w) => ({ w, v: (sellVol.get(w)?.usdt || 0) }))
      .sort((a, b) => b.v - a.v);
    const overallRanked = [...wallets]
      .map((w) => ({ w, v: (buyVol.get(w)?.usdt || 0) + (sellVol.get(w)?.usdt || 0) }))
      .sort((a, b) => b.v - a.v);

    const findRank = (arr: { w: string; v: number }[]) => {
      const idx = arr.findIndex((r) => r.w === me);
      if (idx < 0) return null;
      // Only rank users with non-zero volume
      if (arr[idx].v <= 0) return null;
      return idx + 1;
    };

    const myBuy = buyVol.get(me) || { usdt: 0, bnb: 0 };
    const mySell = sellVol.get(me) || { usdt: 0, bnb: 0 };

    return {
      sellAdsTotal: mySellAds.length,
      sellAdsCompleted: mySellAds.filter((a) => a.status === 2).length,
      sellAdsCancelled: mySellAds.filter((a) => a.status === 3).length,
      sellAdsExpired: mySellAds.filter((a) => a.status === 4).length,

      buyAdsTotal: myBuyAds.length,
      buyAdsActive: myBuyAds.filter((a) => a.status === 0).length,
      buyAdsClosed: myBuyAds.filter((a) => a.status === 1).length,
      buyAdsExpired: myBuyAds.filter((a) => a.status === 2).length,

      dealsCompleted,
      dealsCancelled,
      dealsDisputed,

      usdtBought: myBuy.usdt,
      usdtSold: mySell.usdt,
      bnbBought: myBuy.bnb,
      bnbSold: mySell.bnb,

      rankBuy: findRank(buyRanked),
      rankSell: findRank(sellRanked),
      rankOverall: findRank(overallRanked),
      totalTraders,
    };
  }, [address, sellAds, sellDeals, buyAds, buyDeals]);

  return { stats, isLoading };
}
