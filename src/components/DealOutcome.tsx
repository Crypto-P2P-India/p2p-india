import { CheckCircle2, XCircle, AlertTriangle, ExternalLink, ArrowRight } from "lucide-react";
import { P2P_CONTRACT_ADDRESS } from "@/config/wagmi";

interface DealOutcomeProps {
  status: number;
  isBuyer: boolean;
  buyerConfirmed: boolean;
  sellerConfirmed: boolean;
  tokenAmount: string;
  tokenSymbol: string;
  inrAmount: string;
  buyer: string;
  seller: string;
  dealId: number;
  txHash?: string;
  resolvedRecipient?: string;
}

const shortAddr = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

const BSCSCAN_CONTRACT = `https://bscscan.com/address/${P2P_CONTRACT_ADDRESS}`;

const DealOutcome = ({
  status,
  isBuyer,
  buyerConfirmed,
  sellerConfirmed,
  tokenAmount,
  tokenSymbol,
  inrAmount,
  buyer,
  seller,
  dealId,
  txHash,
  resolvedRecipient,
}: DealOutcomeProps) => {
  // Only show for terminal states
  if (status !== 2 && status !== 3 && status !== 4 && status !== 5) return null;

  const isCompleted = status === 2;
  const isCancelled = status === 3;
  const isDisputed = status === 4;
  const isResolved = status === 5;

  return (
    <div
      className={`mt-3 rounded-lg border p-3 space-y-2 ${
        isCompleted || isResolved
          ? "border-buy/20 bg-buy/5"
          : isDisputed
          ? "border-sell/20 bg-sell/5"
          : "border-border bg-surface-1"
      }`}
    >
      {/* Outcome header */}
      <div className="flex items-center gap-2">
        {(isCompleted || isResolved) && <CheckCircle2 className="h-4 w-4 text-buy shrink-0" />}
        {isCancelled && <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />}
        {isDisputed && <AlertTriangle className="h-4 w-4 text-sell shrink-0" />}
        <span className={`text-sm font-semibold ${(isCompleted || isResolved) ? "text-buy" : isDisputed ? "text-sell" : "text-muted-foreground"}`}>
          {isCompleted && "Trade Completed Successfully"}
          {isResolved && "Dispute Resolved"}
          {isCancelled && "Deal Cancelled"}
          {isDisputed && "Under Dispute — Admin Review"}
        </span>
      </div>

      {/* Flow description */}
      <div className="space-y-1.5 text-xs">
        {isCompleted && (
          <>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-foreground">
                {shortAddr(buyer)}
              </span>
              <span>paid ₹{inrAmount} to</span>
              <span className="inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-foreground">
                {shortAddr(seller)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-foreground">
                {shortAddr(seller)}
              </span>
              <span>released {tokenAmount} {tokenSymbol} to</span>
              <span className="inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-foreground">
                {shortAddr(buyer)}
              </span>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-buy" />
                <span className="text-buy font-medium">Buyer confirmed payment</span>
              </div>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-buy" />
                <span className="text-buy font-medium">Seller confirmed receipt</span>
              </div>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-buy" />
                <span className="text-buy font-medium">Tokens released</span>
              </div>
            </div>
          </>
        )}

        {isCancelled && (
          <>
            <p className="text-muted-foreground">
              {buyerConfirmed
                ? "Deal timed out after buyer confirmed payment but seller did not confirm receipt."
                : "Deal timed out — buyer did not confirm payment in time."}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <div className="flex items-center gap-1">
                {buyerConfirmed ? (
                  <CheckCircle2 className="h-3 w-3 text-buy" />
                ) : (
                  <XCircle className="h-3 w-3 text-muted-foreground" />
                )}
                <span className={buyerConfirmed ? "text-buy font-medium" : "text-muted-foreground"}>
                  Buyer {buyerConfirmed ? "confirmed" : "did not confirm"}
                </span>
              </div>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <div className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Seller did not confirm</span>
              </div>
            </div>
            <p className="text-muted-foreground pt-1">
              <span className="font-medium text-foreground">{tokenAmount} {tokenSymbol}</span> returned to seller{" "}
              <span className="font-mono text-foreground">{shortAddr(seller)}</span>
            </p>
          </>
        )}

        {isDisputed && (
          <>
            <p className="text-muted-foreground">
              A dispute was raised. The admin will review evidence and release funds to the rightful party.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <div className="flex items-center gap-1">
                {buyerConfirmed ? (
                  <CheckCircle2 className="h-3 w-3 text-buy" />
                ) : (
                  <XCircle className="h-3 w-3 text-muted-foreground" />
                )}
                <span className={buyerConfirmed ? "text-buy font-medium" : "text-muted-foreground"}>
                  Buyer {buyerConfirmed ? "confirmed payment" : "not confirmed"}
                </span>
              </div>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-sell" />
                <span className="text-sell font-medium">Dispute raised</span>
              </div>
            </div>
            <p className="text-muted-foreground pt-1">
              <span className="font-medium text-foreground">{tokenAmount} {tokenSymbol}</span> held in escrow until admin resolves.
            </p>
          </>
        )}

        {isResolved && (
          <>
            {(() => {
              const recipientIsBuyer = resolvedRecipient?.toLowerCase() === buyer.toLowerCase();
              const recipientIsSeller = resolvedRecipient?.toLowerCase() === seller.toLowerCase();
              const youReceived = (isBuyer && recipientIsBuyer) || (!isBuyer && recipientIsSeller);
              const recipientLabel = recipientIsBuyer ? "Buyer" : recipientIsSeller ? "Seller" : "unknown";
              const recipientAddr = recipientIsBuyer ? buyer : seller;

              return (
                <>
                  <p className="text-muted-foreground">
                    {youReceived
                      ? `The admin reviewed the dispute and ruled in your favor. You received ${tokenAmount} ${tokenSymbol}.`
                      : resolvedRecipient
                      ? `The admin reviewed the dispute and released ${tokenAmount} ${tokenSymbol} to the ${recipientLabel.toLowerCase()} (${shortAddr(recipientAddr)}).`
                      : "The dispute was reviewed by admin and resolved. Funds have been released to the rightful party."}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-buy" />
                      <span className="text-buy font-medium">Dispute reviewed</span>
                    </div>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-buy" />
                      <span className="text-buy font-medium">
                        {youReceived ? "You received funds" : `${recipientLabel} received funds`}
                      </span>
                    </div>
                  </div>
                  <p className="text-muted-foreground pt-1">
                    <span className="font-medium text-foreground">{tokenAmount} {tokenSymbol}</span> released to{" "}
                    {youReceived ? (
                      <span className="text-buy font-medium">you</span>
                    ) : (
                      <span className="font-mono text-foreground">{shortAddr(recipientAddr)}</span>
                    )}
                  </p>
                </>
              );
            })()}
          </>
        )}
      </div>

      {/* BscScan link — specific tx or contract fallback */}
      <a
        href={txHash ? `https://bscscan.com/tx/${txHash}` : BSCSCAN_CONTRACT}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors pt-1"
      >
        <ExternalLink className="h-3 w-3" />
        {txHash ? `View tx ${txHash.slice(0, 10)}…` : "View on BscScan"}
      </a>
    </div>
  );
};

export default DealOutcome;
