import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface WalletProfile {
  wallet_address: string;
  username: string | null;
  created_at?: string;
  updated_at?: string;
}

const norm = (a: string) => a.toLowerCase();

/** Manage the current user's wallet profile (read + upsert). */
export function useWalletProfile(address: string | undefined) {
  const [profile, setProfile] = useState<WalletProfile | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!address) {
      setProfile(null);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("wallet_profiles")
      .select("*")
      .eq("wallet_address", norm(address))
      .maybeSingle();
    setProfile((data as WalletProfile) ?? { wallet_address: norm(address), username: null });
    setLoading(false);
  }, [address]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateUsername = useCallback(
    async (username: string): Promise<{ ok: boolean; error?: string }> => {
      if (!address) return { ok: false, error: "Connect your wallet first" };
      const trimmed = username.trim();
      if (!/^[A-Za-z0-9_]{3,20}$/.test(trimmed)) {
        return { ok: false, error: "3-20 chars, letters, numbers, underscore only" };
      }
      // Pre-check uniqueness (case-insensitive via citext)
      const { data: existing } = await supabase
        .from("wallet_profiles")
        .select("wallet_address")
        .eq("username", trimmed)
        .maybeSingle();
      if (existing && existing.wallet_address !== norm(address)) {
        return { ok: false, error: "Username already taken" };
      }

      const { error } = await supabase
        .from("wallet_profiles")
        .upsert(
          { wallet_address: norm(address), username: trimmed },
          { onConflict: "wallet_address" }
        );
      if (error) return { ok: false, error: error.message };
      await fetchProfile();
      return { ok: true };
    },
    [address, fetchProfile]
  );

  return { profile, loading, updateUsername, refetch: fetchProfile };
}
