import { Play, Check, CheckCheck, ShieldCheck } from "lucide-react";
import type { ChatMessage } from "@/hooks/useChatMessages";
import { isAdminAddress, ADMIN_DISPLAY_NAME } from "@/lib/admin";
import tobiAvatar from "@/assets/tobi-admin.jpeg.asset.json";

interface MessageBubbleProps {
  msg: ChatMessage;
  onPreview: (url: string, type: string) => void;
}

const shortAddr = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

const MessageBubble = ({ msg, onPreview }: MessageBubbleProps) => {
  const fromAdmin = isAdminAddress(msg.sender_address);

  return (
    <div className={`flex gap-2 ${msg.isOwn ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar for admin (incoming side) */}
      {fromAdmin && !msg.isOwn && (
        <img
          src={tobiAvatar.url}
          alt="Tobi Admin"
          className="h-7 w-7 rounded-full object-cover border border-primary/40 shrink-0 mt-0.5"
        />
      )}

      <div className={`flex flex-col ${msg.isOwn ? "items-end" : "items-start"} max-w-[85%]`}>
        {/* Sender name + admin tag */}
        {fromAdmin && !msg.isOwn && (
          <div className="flex items-center gap-1.5 mb-0.5 px-1">
            <span className="text-xs font-semibold text-primary">{ADMIN_DISPLAY_NAME}</span>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/15 text-primary px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide">
              <ShieldCheck className="h-2.5 w-2.5" /> Admin
            </span>
          </div>
        )}

        {/* Attachment */}
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
        {/* Text */}
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
        {/* Meta row */}
        <div className="flex items-center gap-1 mt-0.5 px-1">
          <span className="text-[10px] text-muted-foreground">
            {fromAdmin ? `${ADMIN_DISPLAY_NAME} · Admin` : shortAddr(msg.sender_address)}
          </span>
          {msg.isOwn && (
            msg.read_at ? (
              <CheckCheck className="h-3 w-3 text-primary" />
            ) : (
              <Check className="h-3 w-3 text-muted-foreground" />
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
