import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";
import { P2P_CONTRACT_ADDRESS } from "@/config/wagmi";

export interface DealEvent {
  name: string;
  label: string;
  txHash: string;
  blockNumber: bigint;
  timestamp?: number;
}

export interface DealTxInfo {
  created?: string;
  buyerConfirmed?: string;
  sellerConfirmed?: string;
  completed?: string;
  cancelled?: string;
  disputed?: string;
  resolved?: string;
  resolvedRecipient?: string;
  events: DealEvent[];
}

export interface DealTxMap {
  [dealId: number]: DealTxInfo;
}

const EVENT_DEFS = [
  { name: "created", label: "Deal Created", abi: parseAbiItem("event DealCreated(uint256 indexed dealId, uint256 indexed adId, address indexed buyer, uint256 amount)") },
  { name: "buyerConfirmed", label: "Buyer Confirmed Payment", abi: parseAbiItem("event DealPaid(uint256 indexed dealId)") },
  { name: "completed", label: "Deal Completed", abi: parseAbiItem("event DealReleased(uint256 indexed dealId, uint256 buyerPayout, uint256 sellerFee, uint256 buyerFee)") },
  { name: "cancelled", label: "Deal Refunded", abi: parseAbiItem("event DealRefunded(uint256 indexed dealId, uint256 amount)") },
  { name: "disputed", label: "Dispute Raised", abi: parseAbiItem("event DisputeRaised(uint256 indexed dealId, address indexed by)") },
  { name: "resolved", label: "Admin Released", abi: parseAbiItem("event AdminReleased(uint256 indexed dealId)") },
  { name: "resolved", label: "Admin Refunded", abi: parseAbiItem("event AdminRefunded(uint256 indexed dealId)") },
  { name: "buyerExtended", label: "Buyer Extended Pay Window", abi: parseAbiItem("event BuyerExtendedPayWindow(uint256 indexed dealId, uint32 addedSeconds)") },
  { name: "sellerProposed", label: "Seller Proposed Extension", abi: parseAbiItem("event SellerProposedExtension(uint256 indexed dealId, uint32 extraSeconds)") },
  { name: "buyerAccepted", label: "Buyer Accepted Extension", abi: parseAbiItem("event BuyerAcceptedExtension(uint256 indexed dealId, uint32 extraSeconds)") },
  { name: "sellerCancelledExt", label: "Seller Withdrew Extension Offer", abi: parseAbiItem("event SellerCancelledExtension(uint256 indexed dealId)") },
] as const;

export function useDealTxHashes(dealIds: number[]): DealTxMap {
  const client = usePublicClient();
  const [txMap, setTxMap] = useState<DealTxMap>({});

  useEffect(() => {
    if (!client || dealIds.length === 0) return;

    let cancelled = false;

    (async () => {
      const map: DealTxMap = {};
      const allBlockNumbers = new Set<bigint>();

      // Fetch logs for all events in parallel
      const results = await Promise.allSettled(
        EVENT_DEFS.map((evt) =>
          client.getLogs({
            address: P2P_CONTRACT_ADDRESS,
            event: evt.abi as any,
            fromBlock: "earliest",
            toBlock: "latest",
          }).then((logs) => ({ name: evt.name, label: evt.label, logs }))
        )
      );

      for (const res of results) {
        if (res.status !== "fulfilled") continue;
        const { name, label, logs } = res.value;
        for (const log of logs) {
          const args = (log as any).args || {};
          const dealId = Number(args.dealId);
          if (!dealIds.includes(dealId)) continue;
          if (!map[dealId]) map[dealId] = { events: [] };
          (map[dealId] as any)[name] = log.transactionHash;
          // Capture recipient for resolved disputes
          if (name === "resolved" && args.recipient) {
            map[dealId].resolvedRecipient = String(args.recipient);
          }
          // Build dynamic, human-readable label
          let evtLabel: string = label;
          const secs = Number(args.addedSeconds ?? args.extraSeconds ?? 0);
          if (secs > 0) {
            const mins = Math.round(secs / 60);
            evtLabel = `${label} (+${mins}m)`;
          }
          map[dealId].events.push({
            name,
            label: evtLabel as string,
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
          });
          allBlockNumbers.add(log.blockNumber);
        }
      }

      // Fetch block timestamps in parallel (deduplicated)
      const blockArr = Array.from(allBlockNumbers);
      const blockTimestamps = new Map<bigint, number>();

      if (blockArr.length > 0) {
        const blockResults = await Promise.allSettled(
          blockArr.map((bn) =>
            client.getBlock({ blockNumber: bn }).then((b) => ({ bn, timestamp: Number(b.timestamp) }))
          )
        );
        for (const br of blockResults) {
          if (br.status === "fulfilled") {
            blockTimestamps.set(br.value.bn, br.value.timestamp);
          }
        }
      }

      // Attach timestamps and sort events chronologically
      for (const dealId of Object.keys(map)) {
        const info = map[Number(dealId)];
        for (const evt of info.events) {
          evt.timestamp = blockTimestamps.get(evt.blockNumber);
        }
        info.events.sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber));
      }

      if (!cancelled) setTxMap(map);
    })();

    return () => { cancelled = true; };
  }, [client, dealIds.join(",")]);

  return txMap;
}
