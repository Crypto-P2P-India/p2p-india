import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useChatMessages } from "@/hooks/useChatMessages";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { useChatPresence } from "@/hooks/useChatPresence";
import MessageBubble from "@/components/chat/MessageBubble";
import TypingIndicator from "@/components/chat/TypingIndicator";
import MediaPreview from "@/components/chat/MediaPreview";

interface ChatPanelProps {
  dealId: number;
  userAddress: string;
  partnerAddress?: string;
  readOnly?: boolean;
  onDealClosed?: boolean;
}

const ChatPanel = ({ dealId, userAddress, partnerAddress, readOnly = false, onDealClosed = false }: ChatPanelProps) => {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ url: string; type: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { messages } = useChatMessages(dealId, userAddress);
  const { isPartnerTyping, sendTyping, stopTyping } = useTypingIndicator(dealId, userAddress);
  const { partnerOnline } = useChatPresence(dealId, userAddress, partnerAddress);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isPartnerTyping]);

  // Cleanup when deal closes
  useEffect(() => {
    if (onDealClosed) {
      const cleanup = async () => {
        try {
          const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
          await fetch(
            `https://${projectId}.supabase.co/functions/v1/cleanup-deal-attachments`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ dealId }),
            }
          );
        } catch (err) {
          console.error("Cleanup failed:", err);
        }
      };
      cleanup();
    }
  }, [onDealClosed, dealId]);

  const handleSend = async () => {
    if (!input.trim() || readOnly || sending) return;
    setSending(true);
    stopTyping();
    const text = input.trim();
    setInput("");

    const { error } = await supabase.from("deal_messages").insert({
      deal_id: dealId,
      sender_address: userAddress,
      message: text,
    });

    if (error) {
      toast.error("Failed to send message");
      setInput(text);
    }
    setSending(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || readOnly) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large (max 10MB)");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("dealId", String(dealId));

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/upload-attachment`,
        { method: "POST", body: formData }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Upload failed");

      const { error } = await supabase.from("deal_messages").insert({
        deal_id: dealId,
        sender_address: userAddress,
        attachment_url: result.url,
        attachment_type: result.type,
      });

      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (e.target.value.trim()) {
      sendTyping();
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-semibold text-foreground">Deal #{dealId} Chat</p>
        <p className="text-xs text-muted-foreground">
          {readOnly ? "View-only — messages stored off-chain" : "Real-time off-chain messaging"}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-muted-foreground text-center px-4">
              {readOnly ? "No messages between parties yet." : "No messages yet. Say hi to your trade partner."}
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            onPreview={(url, type) => setPreviewFile({ url, type })}
          />
        ))}
        {isPartnerTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!readOnly && (
        <div className="border-t border-border p-3">
          <div className="flex gap-2 items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="shrink-0 h-9 w-9"
              title="Upload image or video"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
            </Button>
            <Input
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="bg-muted/50 border-input text-sm"
              maxLength={500}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="shrink-0 h-9 w-9"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      {/* Full-screen preview */}
      {previewFile && (
        <MediaPreview
          url={previewFile.url}
          type={previewFile.type}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
};

export default ChatPanel;
