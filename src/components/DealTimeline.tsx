import { ExternalLink, CheckCircle2, Clock, AlertTriangle, XCircle, Shield, ArrowRight } from "lucide-react";
import type { DealEvent } from "@/hooks/useDealTxHashes";

interface DealTimelineProps {
  events: DealEvent[];
}

const EVENT_STYLE: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  created:            { icon: Clock,          color: "text-primary" },
  buyerConfirmed:     { icon: ArrowRight,     color: "text-buy" },
  sellerConfirmed:    { icon: CheckCircle2,   color: "text-buy" },
  completed:          { icon: Shield,         color: "text-buy" },
  cancelled:          { icon: XCircle,        color: "text-muted-foreground" },
  disputed:           { icon: AlertTriangle,  color: "text-sell" },
  resolved:           { icon: CheckCircle2,   color: "text-primary" },
  buyerExtended:      { icon: Clock,          color: "text-primary" },
  sellerProposed:     { icon: Clock,          color: "text-primary" },
  buyerAccepted:      { icon: CheckCircle2,   color: "text-buy" },
  sellerCancelledExt: { icon: XCircle,        color: "text-muted-foreground" },
};

const formatTs = (ts?: number) => {
  if (!ts) return "…";
  const d = new Date(ts * 1000);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const DealTimeline = ({ events }: DealTimelineProps) => {
  if (!events || events.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg border border-border bg-surface-1 p-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Transaction History</p>
      <div className="relative space-y-0">
        {events.map((evt, i) => {
          const style = EVENT_STYLE[evt.name] || EVENT_STYLE.created;
          const Icon = style.icon;
          const isLast = i === events.length - 1;

          return (
            <div key={`${evt.txHash}-${evt.name}`} className="flex gap-3 relative">
              {/* Vertical line */}
              {!isLast && (
                <div className="absolute left-[11px] top-[22px] bottom-0 w-px bg-border" />
              )}

              {/* Icon */}
              <div className={`relative z-10 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-border bg-card`}>
                <Icon className={`h-3 w-3 ${style.color}`} />
              </div>

              {/* Content */}
              <div className={`pb-4 ${isLast ? "pb-0" : ""}`}>
                <p className="text-sm font-medium text-foreground leading-tight">{evt.label}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground tabular-nums">{formatTs(evt.timestamp)}</span>
                  <a
                    href={`https://bscscan.com/tx/${evt.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    <ExternalLink className="h-2.5 w-2.5" />
                    {evt.txHash.slice(0, 10)}…
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DealTimeline;
