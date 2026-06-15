import { useAccount } from "wagmi";
import { useContractDeals } from "@/hooks/useContractDeals";
import { useDealEventNotifications } from "@/hooks/useDealEventNotifications";

/** Mounted once at the app root to fire global deal-event notifications. */
const DealNotificationsHost = () => {
  const { address } = useAccount();
  const { deals } = useContractDeals();
  useDealEventNotifications(deals, address);
  return null;
};

export default DealNotificationsHost;
