import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, string | null>();
const listeners = new Set<() => void>();

const norm = (a: string) => a.toLowerCase();

async function loadProfiles(addresses: string[]) {
  const missing = addresses.filter((a) => !cache.has(norm(a)));
  if (missing.length === 0) return;
  // mark as null first so we don't re-fetch repeatedly
  missing.forEach((a) => cache.set(norm(a), cache.get(norm(a)) ?? null));
  const { data } = await supabase
    .from("wallet_profiles")
    .select("wallet_address, username")
    .in("wallet_address", missing.map(norm));
  (data || []).forEach((row: any) => {
    cache.set(norm(row.wallet_address), row.username ?? null);
  });
  listeners.forEach((l) => l());
}

export function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function displayNameFor(addr: string): string {
  const u = cache.get(norm(addr));
  return u ? `@${u}` : shortAddr(addr);
}

/** Subscribe to profile cache for the given addresses; returns a displayName(addr) helper. */
export function useWalletProfiles(addresses: string[]) {
  const [, force] = useState(0);

  useEffect(() => {
    const valid = addresses.filter(Boolean);
    if (valid.length === 0) return;
    loadProfiles(valid);
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, [addresses.join(",")]);

  return { displayName: displayNameFor };
}

export function invalidateProfile(addr: string) {
  cache.delete(norm(addr));
  loadProfiles([addr]);
}
