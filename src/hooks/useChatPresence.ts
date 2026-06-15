import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const norm = (a: string) => a.toLowerCase();

/** Tracks whether the partner is currently online in this deal's chat (via Supabase presence). */
export function useChatPresence(dealId: number, myAddress: string, partnerAddress: string | undefined) {
  const [partnerOnline, setPartnerOnline] = useState(false);

  useEffect(() => {
    if (!myAddress || !partnerAddress) return;
    const channel = supabase.channel(`presence-deal-${dealId}-${Date.now()}`, {
      config: { presence: { key: norm(myAddress) } },
    });

    const updatePresence = () => {
      const state = channel.presenceState();
      const online = Object.keys(state).some((k) => k === norm(partnerAddress));
      setPartnerOnline(online);
    };

    channel
      .on("presence", { event: "sync" }, updatePresence)
      .on("presence", { event: "join" }, updatePresence)
      .on("presence", { event: "leave" }, updatePresence)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ at: Date.now() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dealId, myAddress, partnerAddress]);

  return { partnerOnline };
}
