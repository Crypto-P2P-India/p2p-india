import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Counts unread messages from counterparties in deals the user is actually a
 * participant of (i.e. deals where the user has sent at least one message).
 * Prevents stray messages from unrelated deals inflating the badge.
 */
export function useGlobalUnreadCount(userAddress: string | undefined) {
  const [count, setCount] = useState(0);
  const addressRef = useRef(userAddress);
  addressRef.current = userAddress;

  useEffect(() => {
    if (!userAddress) { setCount(0); return; }
    const addr = userAddress.toLowerCase();

    const fetchCount = async () => {
      // 1) Find every deal the user participates in (sent ≥1 message).
      const { data: myDealRows, error: dealErr } = await supabase
        .from("deal_messages")
        .select("deal_id")
        .eq("sender_address", addr);
      if (dealErr) return;

      const dealIds = Array.from(new Set((myDealRows || []).map((r: any) => r.deal_id)));
      if (dealIds.length === 0) { setCount(0); return; }

      // 2) Count unread messages from counterparties in those deals.
      const { count: total, error } = await supabase
        .from("deal_messages")
        .select("*", { count: "exact", head: true })
        .in("deal_id", dealIds)
        .neq("sender_address", addr)
        .is("read_at", null);
      if (!error && total !== null) setCount(total);
    };

    fetchCount();

    const channelName = `global-unread-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "deal_messages" }, () => fetchCount())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userAddress]);

  return count;
}
