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
