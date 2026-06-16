import { useCallback, useEffect, useState } from "react";
import { signMessage } from "@wagmi/core";
import { config as wagmiConfig } from "@/config/wagmi";
import { supabase } from "@/integrations/supabase/client";

export interface WalletProfile {
  wallet_address: string;
  username: string | null;
  created_at?: string;
  updated_at?: string;
}

const norm = (a: string) => a.toLowerCase();

/** Manage the current user's wallet profile (read + signature-gated update). */
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

      // Ask the wallet owner to sign a structured message proving control of this address.
      const timestamp = Date.now();
      const message = `Crypto P2P username update\nWallet: ${address}\nUsername: ${trimmed}\nTimestamp: ${timestamp}`;

      let signature: string;
      try {
        signature = await signMessage(wagmiConfig, { message, account: address as `0x${string}` });
      } catch (e) {
        return { ok: false, error: "Signature rejected" };
      }

      const { data, error } = await supabase.functions.invoke("update-wallet-username", {
        body: { address: norm(address), username: trimmed, message, signature },
      });
      if (error) {
        const msg = (data as { error?: string } | null)?.error || error.message;
        return { ok: false, error: msg };
      }
      if (data && (data as { error?: string }).error) {
        return { ok: false, error: (data as { error: string }).error };
      }
      await fetchProfile();
      return { ok: true };
    },
    [address, fetchProfile]
  );

  return { profile, loading, updateUsername, refetch: fetchProfile };
}
