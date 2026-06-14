import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUnreadCounts(dealIds: number[], userAddress: string) {
  const [counts, setCounts] = useState<Record<number, number>>({});

  const fetchCounts = useCallback(async () => {
    if (!dealIds.length || !userAddress) return;
    const addr = userAddress.toLowerCase();

    const { data, error } = await supabase
      .from("deal_messages")
      .select("deal_id")
      .in("deal_id", dealIds)
      .neq("sender_address", addr)
      .is("read_at", null);

    if (error) {
      console.error("Failed to fetch unread counts:", error);
      return;
    }

    const map: Record<number, number> = {};
    for (const row of data || []) {
      map[row.deal_id] = (map[row.deal_id] || 0) + 1;
    }
    setCounts(map);
  }, [dealIds.join(","), userAddress]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  // Real-time updates
  useEffect(() => {
    if (!dealIds.length || !userAddress) return;

    const channel = supabase.channel(`unread-counts-${Date.now()}-${Math.random()}`);
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "deal_messages" },
      () => { fetchCounts(); }
    );
    channel.subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [dealIds.join(","), userAddress, fetchCounts]);

  return counts;
}
