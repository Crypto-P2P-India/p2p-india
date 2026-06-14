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
import StatsBar from "@/components/StatsBar";
import CryptoFilter from "@/components/CryptoFilter";
import TradeWindow from "@/components/TradeWindow";
import { useContractAds, LiveAd } from "@/hooks/useContractAds";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

const Index = () => {
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();
  const [crypto, setCrypto] = useState("USDT");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // Listen for bottom nav create button
  useEffect(() => {
    const handler = () => setShowCreate(true);
    window.addEventListener("open-create-modal", handler);
    return () => window.removeEventListener("open-create-modal", handler);
  }, []);
  const [selectedAd, setSelectedAd] = useState<LiveAd | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [maxPrice, setMaxPrice] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [expiredBannerDismissed, setExpiredBannerDismissed] = useState(false);

  const { ads: liveAds, isLoading, refetch: refetchAds } = useContractAds();

  const handleRefresh = useCallback(async () => {
    await refetchAds();
    await new Promise((r) => setTimeout(r, 600));
  }, [refetchAds]);

  const { containerRef, pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  const now = Date.now() / 1000;

  // Check for user's expired unclaimed ads
  const expiredUnclaimedAds = useMemo(() => {
    if (!address) return [];
    return liveAds.filter(
      (ad) => ad.seller.toLowerCase() === address.toLowerCase() && ad.status === 0 && ad.adExpiry < now
    );
  }, [liveAds, address, now]);

  const ownAdsCount = useMemo(() => {
    if (!address) return 0;
    return liveAds.filter(
      (ad) => ad.seller.toLowerCase() === address.toLowerCase() && ad.status !== 3 && ad.adExpiry >= now
    ).length;
  }, [liveAds, address, now]);

  const filteredAds = useMemo(() => {
    return liveAds
      .filter((ad) => {
        if (ad.status === 3) return false;
        if (ad.adExpiry < now) return false;
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

        {/* Expired funds alert */}
        {isConnected && expiredUnclaimedAds.length > 0 && !expiredBannerDismissed && (
          <div className="mb-6 rounded-lg border border-sell/30 bg-sell/5 p-4 animate-fade-up">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sell/10">
                <AlertTriangle className="h-5 w-5 text-sell" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Unclaimed Expired Funds</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  You have <span className="font-bold text-sell">{expiredUnclaimedAds.length}</span> expired ad{expiredUnclaimedAds.length > 1 ? "s" : ""} with locked funds.
                  Claim them back from My Ads → Expired tab.
                </p>
                <div className="flex gap-2 mt-2.5">
                  <Button size="sm" variant="sell" onClick={() => navigate("/my-ads")} className="text-xs">
                    Go to My Ads
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setExpiredBannerDismissed(true)} className="text-xs text-muted-foreground">
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="mb-8">
          <StatsBar />
        </div>

        {/* Controls */}
        <div className="mb-6 space-y-3 animate-fade-up" style={{ animationDelay: "200ms" }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CryptoFilter selected={crypto} onSelect={setCrypto} />

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
                onClick={() => setShowCreate(true)}
                className="gap-2 shrink-0"
                disabled={!isConnected}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Post Ad</span>
              </Button>
            </div>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="flex flex-wrap gap-3 rounded-lg border border-border bg-card p-3 animate-fade-up">
              <div className="flex-1 min-w-[140px]">
                <label className="text-xs text-muted-foreground mb-1 block">Max Price (₹)</label>
                <Input
                  type="number"
                  placeholder="e.g. 95"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="bg-surface-2 border-input h-8 text-sm"
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="text-xs text-muted-foreground mb-1 block">Min Amount ({crypto})</label>
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
            Showing {filteredAds.length} ad{filteredAds.length !== 1 ? "s" : ""} · sorted low → high price
          </p>
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
        {isConnected && (
          <div className="space-y-3">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16 text-center animate-pulse">
                <p className="text-muted-foreground text-sm">Loading ads from contract…</p>
              </div>
            ) : filteredAds.length > 0 ? (
              filteredAds.map((ad, i) => (
                <OrderCard
                  key={ad.adId}
                  {...ad}
                  index={i}
                  onTrade={() => setSelectedAd(ad)}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16 text-center animate-fade-up">
                <p className="text-muted-foreground text-sm mb-1">No live ads for {crypto}</p>
                <p className="text-xs text-muted-foreground mb-3">
                  {maxPrice || minAmount ? "Try adjusting your filters." : "Be the first to post a sell ad and start trading."}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setMaxPrice(""); setMinAmount(""); setShowCreate(true); }}
                >
                  {maxPrice || minAmount ? "Clear Filters" : "Create the first ad"}
                </Button>
              </div>
            )}
          </div>
        )}
      </main>

      
      <FaqSection />
      <Footer />

      <CreateOrderModal open={showCreate} onClose={() => setShowCreate(false)} />

      {selectedAd && address && (
        <TradeWindow
          ad={selectedAd}
          userAddress={address}
          onClose={() => { setSelectedAd(null); refetchAds(); }}
        />
      )}
    </div>
  );
};

export default Index;
