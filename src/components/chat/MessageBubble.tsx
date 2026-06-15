import { Play, Check, CheckCheck, ShieldCheck } from "lucide-react";
import type { ChatMessage } from "@/hooks/useChatMessages";
import { isAdminAddress, ADMIN_DISPLAY_NAME } from "@/lib/admin";
import tobiAvatar from "@/assets/tobi-admin.jpeg.asset.json";
import { useWalletProfiles, shortAddr } from "@/hooks/useWalletProfiles";

interface MessageBubbleProps {
  msg: ChatMessage;
  onPreview: (url: string, type: string) => void;
  /** Whether the partner is currently online (for 2-grey-ticks delivered state). */
  partnerOnline?: boolean;
}

const MessageBubble = ({ msg, onPreview, partnerOnline = false }: MessageBubbleProps) => {
  const fromAdmin = isAdminAddress(msg.sender_address);
  const { displayName } = useWalletProfiles([msg.sender_address]);
  const senderLabel = fromAdmin
    ? `${ADMIN_DISPLAY_NAME} · Admin`
    : displayName(msg.sender_address) || shortAddr(msg.sender_address);

  // Tick state for own messages:
  //   read_at present → 2 blue ticks (read)
  //   partner online → 2 grey ticks (delivered)
  //   otherwise → 1 grey tick (sent)
  const renderTicks = () => {
    if (!msg.isOwn) return null;
    if (msg.read_at) return <CheckCheck className="h-3 w-3 text-primary" />;
    if (partnerOnline) return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
    return <Check className="h-3 w-3 text-muted-foreground" />;
  };

  return (
    <div className={`flex gap-2 ${msg.isOwn ? "flex-row-reverse" : "flex-row"}`}>
      {fromAdmin && !msg.isOwn && (
        <img
          src={tobiAvatar.url}
          alt="Tobi Admin"
          className="h-7 w-7 rounded-full object-cover border border-primary/40 shrink-0 mt-0.5"
        />
      )}

      <div className={`flex flex-col ${msg.isOwn ? "items-end" : "items-start"} max-w-[85%]`}>
        {fromAdmin && !msg.isOwn && (
          <div className="flex items-center gap-1.5 mb-0.5 px-1">
            <span className="text-xs font-semibold text-primary">{ADMIN_DISPLAY_NAME}</span>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/15 text-primary px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide">
              <ShieldCheck className="h-2.5 w-2.5" /> Admin
            </span>
          </div>
        )}

        {msg.attachment_url && (
          <div
            className={`rounded-lg overflow-hidden mb-1 cursor-pointer ${
              msg.isOwn ? "bg-primary/10" : "bg-muted"
            }`}
            onClick={() => onPreview(msg.attachment_url!, msg.attachment_type || "image")}
          >
            {msg.attachment_type === "video" ? (
              <div className="relative w-48 h-32 bg-black/20 flex items-center justify-center">
                <video src={msg.attachment_url} className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Play className="h-8 w-8 text-white/80" />
                </div>
              </div>
            ) : (
              <img
                src={msg.attachment_url}
                alt="Attachment"
                className="max-w-48 max-h-48 object-cover"
                loading="lazy"
              />
            )}
          </div>
        )}
        {msg.message && (
          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              msg.isOwn
                ? "bg-primary text-primary-foreground"
                : fromAdmin
                ? "bg-primary/10 text-foreground border border-primary/30"
                : "bg-muted text-foreground"
            }`}
          >
            {msg.message}
          </div>
        )}
        <div className="flex items-center gap-1 mt-0.5 px-1">
          <span className="text-[10px] text-muted-foreground">{senderLabel}</span>
          {renderTicks()}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
