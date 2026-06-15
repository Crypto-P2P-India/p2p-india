import { useState, useMemo, useEffect, useCallback } from "react";
import { Plus, Search, Wallet, SlidersHorizontal, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FaqSection from "@/components/FaqSection";

import LandingHero from "@/components/LandingHero";
import OrderCard from "@/components/OrderCard";
import CreateOrderModal from "@/components/CreateOrderModal";
import CreateBuyAdModal from "@/components/CreateBuyAdModal";
import BuyAdCard from "@/components/BuyAdCard";
import StatsBar from "@/components/StatsBar";
import CryptoFilter from "@/components/CryptoFilter";
import TradeWindow from "@/components/TradeWindow";
import BuyTradeWindow from "@/components/BuyTradeWindow";
import { useContractAds, LiveAd } from "@/hooks/useContractAds";
import { useBuyContractAds, LiveBuyAd } from "@/hooks/useBuyContractAds";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

const Index = () => {
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"sell" | "buy">("sell"); // sell = sell-ads tab (buyers browsing), buy = buy-ads tab (sellers browsing)
  const [crypto, setCrypto] = useState("USDT");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateBuy, setShowCreateBuy] = useState(false);

  // Listen for bottom nav create button — opens whichever tab is active
  useEffect(() => {
    const handler = () => (mode === "sell" ? setShowCreate(true) : setShowCreateBuy(true));
    window.addEventListener("open-create-modal", handler);
    return () => window.removeEventListener("open-create-modal", handler);
  }, [mode]);
  const [selectedAd, setSelectedAd] = useState<LiveAd | null>(null);
  const [selectedBuyAd, setSelectedBuyAd] = useState<LiveBuyAd | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [maxPrice, setMaxPrice] = useState("");
  const [minAmount, setMinAmount] = useState("");
  

  const { ads: liveAds, isLoading, refetch: refetchAds } = useContractAds();
  const { ads: buyAds, isLoading: loadingBuyAds, refetch: refetchBuyAds } = useBuyContractAds();

  const handleRefresh = useCallback(async () => {
    await refetchAds();
    await refetchBuyAds();
    await new Promise((r) => setTimeout(r, 600));
  }, [refetchAds, refetchBuyAds]);

  const { containerRef, pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  const now = Date.now() / 1000;

  const ownAdsCount = useMemo(() => {
    if (!address) return 0;
    return liveAds.filter(
      (ad) => ad.seller.toLowerCase() === address.toLowerCase() && ad.status !== 3
    ).length;
  }, [liveAds, address]);

  const filteredAds = useMemo(() => {
    return liveAds
      .filter((ad) => {
        if (ad.status === 3) return false;
        
        if (parseFloat(ad.tokenAmount) <= 0) return false;
        if (address && ad.seller.toLowerCase() === address.toLowerCase()) return false;
        const matchesCrypto = ad.tokenSymbol === crypto;
        const matchesSearch = !search || ad.seller.toLowerCase().includes(search.toLowerCase());
        const matchesPrice = !maxPrice || parseFloat(ad.pricePerToken) <= parseFloat(maxPrice);
        const matchesAmount = !minAmount || parseFloat(ad.tokenAmount) >= parseFloat(minAmount);
        return matchesCrypto && matchesSearch && matchesPrice && matchesAmount;
      })
      .sort((a, b) => parseFloat(a.pricePerToken) - parseFloat(b.pricePerToken));
  }, [liveAds, crypto, search, maxPrice, minAmount, address, now]);

  const ownBuyAdsCount = useMemo(() => {
    if (!address) return 0;
    return buyAds.filter((ad) => ad.buyer.toLowerCase() === address.toLowerCase() && ad.status === 0).length;
  }, [buyAds, address]);

  const filteredBuyAds = useMemo(() => {
    return buyAds
      .filter((ad) => {
        if (ad.status !== 0) return false;
        if (parseFloat(ad.remainingUsdt) <= 0) return false;
        if (address && ad.buyer.toLowerCase() === address.toLowerCase()) return false;
        const matchesSearch = !search || ad.buyer.toLowerCase().includes(search.toLowerCase());
        const matchesPrice = !maxPrice || parseFloat(ad.rateInrPerUsdt) >= parseFloat(maxPrice);
        const matchesAmount = !minAmount || parseFloat(ad.remainingUsdt) >= parseFloat(minAmount);
        return matchesSearch && matchesPrice && matchesAmount;
      })
      .sort((a, b) => parseFloat(b.rateInrPerUsdt) - parseFloat(a.rateInrPerUsdt));
  }, [buyAds, search, maxPrice, minAmount, address]);

  return (
    <div ref={containerRef} className="min-h-screen bg-background overflow-auto">
      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="flex items-center justify-center overflow-hidden transition-[height] duration-200 ease-out"
          style={{ height: pullDistance > 0 ? pullDistance : isRefreshing ? 48 : 0 }}
        >
          <RefreshCw
            className={`h-5 w-5 text-primary transition-transform duration-200 ${
              isRefreshing ? "animate-spin" : ""
            }`}
            style={{
              transform: isRefreshing
                ? undefined
                : `rotate(${Math.min(pullDistance * 3, 360)}deg)`,
              opacity: Math.min(pullDistance / 60, 1),
            }}
          />
        </div>
      )}
      <Navbar />

      {/* Landing sections for new visitors */}
      {!isConnected && <LandingHero />}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Section title */}
        <div className="mb-8 animate-fade-up">
          <h2 className="text-xl font-bold text-foreground sm:text-2xl" style={{ lineHeight: "1.1" }}>
            {isConnected ? "P2P Trading" : "Live Ads"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isConnected
              ? "Trade BNB & USDT directly with other users. Smart contract escrow — no middlemen."
              : "Connect your wallet to start trading. Here's what's available right now."}
          </p>
        </div>

        {/* (Expired ads banner removed — contract has no time-based ad expiry.) */}

        {/* Stats */}
        <div className="mb-8">
          <StatsBar />
        </div>

        {/* Buy/Sell tabs */}
        <div className="mb-4 inline-flex rounded-lg border border-border bg-surface-2 p-1 animate-fade-up">
          <button
            onClick={() => setMode("sell")}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
              mode === "sell" ? "bg-buy text-buy-foreground shadow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Buy crypto
          </button>
          <button
            onClick={() => setMode("buy")}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
              mode === "buy" ? "bg-sell text-sell-foreground shadow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sell crypto
          </button>
        </div>

        {/* Controls */}
        <div className="mb-6 space-y-3 animate-fade-up" style={{ animationDelay: "200ms" }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {mode === "sell" ? <CryptoFilter selected={crypto} onSelect={setCrypto} /> : <div />}

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-56 sm:flex-none">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by address..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-surface-2 border-input pl-9"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
                className={showFilters ? "border-primary text-primary" : ""}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => (mode === "sell" ? setShowCreate(true) : setShowCreateBuy(true))}
                className="gap-2 shrink-0"
                disabled={!isConnected}
                variant={mode === "buy" ? "sell" : "default"}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">{mode === "sell" ? "Post Sell Ad" : "Post Buy Ad"}</span>
              </Button>
            </div>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="flex flex-wrap gap-3 rounded-lg border border-border bg-card p-3 animate-fade-up">
              <div className="flex-1 min-w-[140px]">
                <label className="text-xs text-muted-foreground mb-1 block">
                  {mode === "sell" ? "Max Price (₹)" : "Min Rate (₹)"}
                </label>
                <Input
                  type="number"
                  placeholder={mode === "sell" ? "e.g. 95" : "e.g. 90"}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="bg-surface-2 border-input h-8 text-sm"
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="text-xs text-muted-foreground mb-1 block">Min Amount ({mode === "sell" ? crypto : "USDT"})</label>
                <Input
                  type="number"
                  placeholder="e.g. 10"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  className="bg-surface-2 border-input h-8 text-sm"
                />
              </div>
              {(maxPrice || minAmount) && (
                <div className="flex items-end">
                  <Button variant="ghost" size="sm" onClick={() => { setMaxPrice(""); setMinAmount(""); }}>
                    Clear
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Sort indicator */}
          <p className="text-xs text-muted-foreground">
            {mode === "sell"
              ? `Showing ${filteredAds.length} ad${filteredAds.length !== 1 ? "s" : ""} · sorted low → high price`
              : `Showing ${filteredBuyAds.length} buy ad${filteredBuyAds.length !== 1 ? "s" : ""} · sorted high → low rate`}
          </p>

          {isConnected && mode === "sell" && ownAdsCount > 0 && (
            <p className="text-xs text-muted-foreground">
              You have <span className="font-semibold text-foreground">{ownAdsCount}</span> ad{ownAdsCount > 1 ? "s" : ""} of your own — hidden here.{" "}
              <button onClick={() => navigate("/my-ads")} className="text-primary font-semibold hover:underline">View in My Ads →</button>
            </p>
          )}
          {isConnected && mode === "buy" && ownBuyAdsCount > 0 && (
            <p className="text-xs text-muted-foreground">
              You have <span className="font-semibold text-foreground">{ownBuyAdsCount}</span> buy ad{ownBuyAdsCount > 1 ? "s" : ""} of your own — hidden here.{" "}
              <button onClick={() => navigate("/my-ads")} className="text-sell font-semibold hover:underline">View in My Ads →</button>
            </p>
          )}
        </div>

        {/* Connection prompt */}
        {!isConnected && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16 text-center animate-fade-up">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Wallet className="h-8 w-8 text-primary" />
            </div>
            <p className="text-foreground font-semibold mb-1">Connect your wallet</p>
            <p className="text-muted-foreground text-sm mb-4 max-w-sm">
              Connect your BNB Smart Chain wallet to view live ads, create orders, and start trading.
            </p>
            <div className="scale-90 origin-center">
              <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
            </div>
          </div>
        )}

        {/* Order List */}
        {isConnected && mode === "sell" && (
          <div className="space-y-3">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16 text-center animate-pulse">
                <p className="text-muted-foreground text-sm">Loading ads from contract…</p>
              </div>
            ) : filteredAds.length > 0 ? (
              filteredAds.map((ad, i) => (
                <OrderCard key={ad.adId} {...ad} index={i} onTrade={() => setSelectedAd(ad)} />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16 text-center animate-fade-up">
                <p className="text-muted-foreground text-sm mb-1">
                  {ownAdsCount > 0 && !maxPrice && !minAmount ? "Your own live ads are hidden here" : `No live ads for ${crypto}`}
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  {maxPrice || minAmount ? "Try adjusting your filters." : ownAdsCount > 0 ? "Other buyers can still see and accept the remaining available amount." : "Be the first to post a sell ad and start trading."}
                </p>
                <Button variant="outline" size="sm" onClick={() => { setMaxPrice(""); setMinAmount(""); ownAdsCount > 0 ? navigate("/my-ads") : setShowCreate(true); }}>
                  {maxPrice || minAmount ? "Clear Filters" : ownAdsCount > 0 ? "View My Ads" : "Create the first ad"}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Buy Ads List */}
        {isConnected && mode === "buy" && (
          <div className="space-y-3">
            {loadingBuyAds ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16 text-center animate-pulse">
                <p className="text-muted-foreground text-sm">Loading buy ads from contract…</p>
              </div>
            ) : filteredBuyAds.length > 0 ? (
              filteredBuyAds.map((ad, i) => (
                <BuyAdCard key={ad.adId} ad={ad} index={i} onTrade={() => setSelectedBuyAd(ad)} />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16 text-center animate-fade-up">
                <p className="text-muted-foreground text-sm mb-1">
                  {ownBuyAdsCount > 0 && !maxPrice && !minAmount ? "Your own buy ads are hidden here" : "No active buy ads right now"}
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  {maxPrice || minAmount ? "Try adjusting your filters." : ownBuyAdsCount > 0 ? "Sellers will see your buy ad and accept it." : "Be the first to post a buy ad and let sellers come to you."}
                </p>
                <Button variant="outline" size="sm" onClick={() => { setMaxPrice(""); setMinAmount(""); ownBuyAdsCount > 0 ? navigate("/my-ads") : setShowCreateBuy(true); }}>
                  {maxPrice || minAmount ? "Clear Filters" : ownBuyAdsCount > 0 ? "View My Ads" : "Create the first buy ad"}
                </Button>
              </div>
            )}
          </div>
        )}
      </main>

      
      <FaqSection />
      <Footer />

      <CreateOrderModal open={showCreate} onClose={() => setShowCreate(false)} />
      <CreateBuyAdModal open={showCreateBuy} onClose={() => { setShowCreateBuy(false); refetchBuyAds(); }} />

      {selectedAd && address && (
        <TradeWindow ad={selectedAd} userAddress={address} onClose={() => { setSelectedAd(null); refetchAds(); }} />
      )}
      {selectedBuyAd && address && (
        <BuyTradeWindow ad={selectedBuyAd} userAddress={address} onClose={() => { setSelectedBuyAd(null); refetchBuyAds(); }} />
      )}
    </div>
  );
};

export default Index;
