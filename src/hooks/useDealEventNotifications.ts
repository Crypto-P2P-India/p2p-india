import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { playSuccessChime, playAlertChime } from "@/lib/sounds";
import type { LiveDeal } from "@/hooks/useContractDeals";

type Snapshot = {
  exists: boolean;
  status: number;
  paidAt: number;
};

function notify(title: string, body: string) {
  if (typeof window === "undefined") return;
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, { body, icon: "/favicon.png", tag: title + body });
    } catch {}
  }
  toast.success(title, { description: body });
}

/**
 * Watches the user's deals for status transitions and fires browser notifications +
 * in-app toasts on key events (accepted, marked paid, released, refunded, disputed).
 */
export function useDealEventNotifications(deals: LiveDeal[] | undefined, myAddress: string | undefined) {
  const prevRef = useRef<Map<number, Snapshot>>(new Map());
  const initialisedRef = useRef(false);

  useEffect(() => {
    if (!myAddress || !deals) return;

    const me = myAddress.toLowerCase();
    const prev = prevRef.current;
    const next = new Map<number, Snapshot>();

    for (const d of deals) {
      const isMine = d.buyer.toLowerCase() === me || d.seller.toLowerCase() === me;
      if (!isMine) continue;
      const snap: Snapshot = { exists: true, status: d.status, paidAt: d.paidAt };
      next.set(d.dealId, snap);

      if (!initialisedRef.current) continue;
      const before = prev.get(d.dealId);
      const iAmSeller = d.seller.toLowerCase() === me;

      // New deal created (someone accepted my ad)
      if (!before) {
        if (iAmSeller) {
          notify("New deal opened", `Deal #${d.dealId} — buyer locked ${d.tokenAmount} ${d.tokenSymbol}`);
          playSuccessChime();
        } else {
          notify("Deal started", `Deal #${d.dealId} is now active. Send the payment.`);
          playSuccessChime();
        }
        continue;
      }

      // Status transitions
      if (before.status !== d.status) {
        switch (d.status) {
          case 1: // PAID
            if (iAmSeller) {
              notify("Buyer marked paid", `Deal #${d.dealId} — verify and release crypto.`);
              playAlertChime();
            } else {
              notify("Payment marked", `Deal #${d.dealId} marked as paid.`);
            }
            break;
          case 2: // RELEASED
            if (!iAmSeller) {
              notify("Crypto released!", `Deal #${d.dealId} — funds released to your wallet.`);
              playSuccessChime();
            } else {
              notify("Deal completed", `Deal #${d.dealId} released successfully.`);
              playSuccessChime();
            }
            break;
          case 3: // REFUNDED
            notify("Deal refunded", `Deal #${d.dealId} was refunded.`);
            playAlertChime();
            break;
          case 4: // DISPUTED
            notify("Dispute raised", `Deal #${d.dealId} is now under admin review.`);
            playAlertChime();
            break;
          case 5: // RESOLVED
            notify("Dispute resolved", `Deal #${d.dealId} has been resolved by admin.`);
            playAlertChime();
            break;
        }
      }
    }

    prevRef.current = next;
    if (!initialisedRef.current) initialisedRef.current = true;
  }, [deals, myAddress]);
}
