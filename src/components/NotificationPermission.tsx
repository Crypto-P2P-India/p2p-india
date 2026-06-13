import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "notif-prompt-dismissed-at";
const SHOW_AGAIN_AFTER_MS = 1000 * 60 * 60 * 24; // 24h

const NotificationPermission = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < SHOW_AGAIN_AFTER_MS) return;

    const t = setTimeout(() => setOpen(true), 1500);
    return () => clearTimeout(t);
  }, []);

  const allow = async () => {
    try {
      await Notification.requestPermission();
    } catch {}
    setOpen(false);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-4 safe-bottom animate-fade-up">
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card shadow-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">Enable Notifications</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Get instant alerts for new deals, chat messages, and trade updates.
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={allow} className="text-xs">Allow</Button>
              <Button size="sm" variant="ghost" onClick={dismiss} className="text-xs text-muted-foreground">
                Not now
              </Button>
            </div>
          </div>
          <button
            onClick={dismiss}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationPermission;
