import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useBalance, useChainId } from "wagmi";
import { useWalletProfile } from "@/hooks/useWalletProfile";
import { invalidateProfile } from "@/hooks/useWalletProfiles";
import { useTraderStats } from "@/hooks/useTraderStats";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Wallet, User as UserIcon, Loader2, Copy, CheckCircle2, TrendingUp, TrendingDown, Trophy, Users, Megaphone, ShoppingCart, XCircle, Activity } from "lucide-react";

const Profile = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { profile, loading, updateUsername } = useWalletProfile(address);
  const { data: bnbBal } = useBalance({ address, query: { enabled: !!address } });
  const { stats, isLoading: statsLoading } = useTraderStats(address);
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUsername(profile?.username ?? "");
  }, [profile?.username]);

  const handleSave = async () => {
    if (!address) return;
    setSaving(true);
    const res = await updateUsername(username);
    setSaving(false);
    if (res.ok) {
      invalidateProfile(address);
      toast.success("Username saved");
    } else {
      toast.error(res.error || "Failed to save");
    }
  };

  const copyAddr = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-foreground">Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Set a unique username to appear instead of your wallet address everywhere.
          </p>
        </header>

        {!isConnected ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <Wallet className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Connect your wallet to view your profile.</p>
          </div>
        ) : (
          <>
            {/* On-chain identity card */}
            <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/15 text-primary flex items-center justify-center text-lg font-bold">
                  {(profile?.username?.[0] || address?.[2] || "?").toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-foreground truncate">
                    {profile?.username ? `@${profile.username}` : "Anonymous Trader"}
                  </p>
                  <button
                    onClick={copyAddr}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-0.5"
                  >
                    <span className="font-mono">{address?.slice(0, 6)}…{address?.slice(-4)}</span>
                    {copied ? <CheckCircle2 className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-surface-3 p-3">
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Network</dt>
                  <dd className="font-semibold text-foreground">
                    {chainId === 56 ? "BNB Smart Chain" : `Chain ${chainId}`}
                  </dd>
                </div>
                <div className="rounded-xl bg-surface-3 p-3">
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">BNB Balance</dt>
                  <dd className="font-semibold text-foreground">
                    {bnbBal ? `${parseFloat(bnbBal.formatted).toFixed(4)} BNB` : "—"}
                  </dd>
                </div>
              </dl>
            </section>

            {/* Trading stats */}
            <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Trading Activity</h2>
                {statsLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </div>

              {/* Volume */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-buy/10 border border-buy/20 p-3">
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-buy">
                    <TrendingDown className="h-3 w-3" /> USDT Bought
                  </div>
                  <p className="text-lg font-bold text-foreground tabular-nums mt-1">
                    {(stats?.usdtBought ?? 0).toFixed(2)}
                  </p>
                  {(stats?.bnbBought ?? 0) > 0 && (
                    <p className="text-[10px] text-muted-foreground tabular-nums">+ {(stats?.bnbBought ?? 0).toFixed(4)} BNB</p>
                  )}
                </div>
                <div className="rounded-xl bg-sell/10 border border-sell/20 p-3">
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-sell">
                    <TrendingUp className="h-3 w-3" /> USDT Sold
                  </div>
                  <p className="text-lg font-bold text-foreground tabular-nums mt-1">
                    {(stats?.usdtSold ?? 0).toFixed(2)}
                  </p>
                  {(stats?.bnbSold ?? 0) > 0 && (
                    <p className="text-[10px] text-muted-foreground tabular-nums">+ {(stats?.bnbSold ?? 0).toFixed(4)} BNB</p>
                  )}
                </div>
              </div>

              {/* Rankings */}
              <div className="rounded-xl bg-surface-3 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-3 w-3" /> Total traders
                  </span>
                  <span className="font-semibold text-foreground tabular-nums">{stats?.totalTraders ?? 0}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div>
                    <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-buy">
                      <Trophy className="h-3 w-3" /> Buy
                    </div>
                    <p className="text-sm font-bold text-foreground tabular-nums">
                      {stats?.rankBuy ? `#${stats.rankBuy}` : "—"}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-sell">
                      <Trophy className="h-3 w-3" /> Sell
                    </div>
                    <p className="text-sm font-bold text-foreground tabular-nums">
                      {stats?.rankSell ? `#${stats.rankSell}` : "—"}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-primary">
                      <Trophy className="h-3 w-3" /> Overall
                    </div>
                    <p className="text-sm font-bold text-foreground tabular-nums">
                      {stats?.rankOverall ? `#${stats.rankOverall}` : "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Ads breakdown */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-surface-3 p-3 space-y-1.5">
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <Megaphone className="h-3 w-3" /> Sell Ads
                  </div>
                  <p className="text-lg font-bold text-foreground tabular-nums">{stats?.sellAdsTotal ?? 0}</p>
                  <div className="text-[10px] text-muted-foreground space-y-0.5">
                    <div className="flex justify-between"><span>✅ Completed</span><span className="text-foreground tabular-nums">{stats?.sellAdsCompleted ?? 0}</span></div>
                    <div className="flex justify-between"><span>↩️ Cancelled</span><span className="text-foreground tabular-nums">{stats?.sellAdsCancelled ?? 0}</span></div>
                    <div className="flex justify-between"><span>⏰ Expired</span><span className="text-foreground tabular-nums">{stats?.sellAdsExpired ?? 0}</span></div>
                  </div>
                </div>
                <div className="rounded-xl bg-surface-3 p-3 space-y-1.5">
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <ShoppingCart className="h-3 w-3" /> Buy Ads
                  </div>
                  <p className="text-lg font-bold text-foreground tabular-nums">{stats?.buyAdsTotal ?? 0}</p>
                  <div className="text-[10px] text-muted-foreground space-y-0.5">
                    <div className="flex justify-between"><span>🟢 Active</span><span className="text-foreground tabular-nums">{stats?.buyAdsActive ?? 0}</span></div>
                    <div className="flex justify-between"><span>↩️ Closed</span><span className="text-foreground tabular-nums">{stats?.buyAdsClosed ?? 0}</span></div>
                    <div className="flex justify-between"><span>⏰ Expired</span><span className="text-foreground tabular-nums">{stats?.buyAdsExpired ?? 0}</span></div>
                  </div>
                </div>
              </div>

              {/* Deals */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-surface-3 p-2">
                  <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-buy">
                    <CheckCircle2 className="h-3 w-3" /> Done
                  </div>
                  <p className="text-sm font-bold text-foreground tabular-nums">{stats?.dealsCompleted ?? 0}</p>
                </div>
                <div className="rounded-xl bg-surface-3 p-2">
                  <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <XCircle className="h-3 w-3" /> Cancelled
                  </div>
                  <p className="text-sm font-bold text-foreground tabular-nums">{stats?.dealsCancelled ?? 0}</p>
                </div>
                <div className="rounded-xl bg-surface-3 p-2">
                  <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-sell">
                    ⚠️ Disputed
                  </div>
                  <p className="text-sm font-bold text-foreground tabular-nums">{stats?.dealsDisputed ?? 0}</p>
                </div>
              </div>
            </section>


            {/* Username editor */}
            <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Username</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                3-20 chars · letters, numbers, underscore. Must be unique. You can change it anytime.
              </p>
              <div className="flex gap-2">
                <span className="flex items-center px-3 rounded-lg bg-surface-3 text-muted-foreground text-sm">@</span>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your_username"
                  maxLength={20}
                  className="flex-1"
                  disabled={loading || saving}
                />
                <Button onClick={handleSave} disabled={saving || loading || !username.trim()}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
};

export default Profile;
