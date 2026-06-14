import { MessageCircle, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const TG_LINK = "https://t.me/Xplorertobi38";

const SupportButton = () => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const startPtr = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const isDragging = useRef(false);

  useEffect(() => {
    const x = window.innerWidth - 72;
    const y = window.innerHeight - 160;
    posRef.current = { x, y };
    setPos({ x, y });
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    isDragging.current = false;
    moved.current = false;
    startPtr.current = { x: e.clientX, y: e.clientY };
    startPos.current = { ...posRef.current };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - startPtr.current.x;
    const dy = e.clientY - startPtr.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      moved.current = true;
      isDragging.current = true;
    }
    if (!moved.current) return;
    const newX = Math.max(8, Math.min(window.innerWidth - 64, startPos.current.x + dx));
    const newY = Math.max(60, Math.min(window.innerHeight - 140, startPos.current.y + dy));
    posRef.current = { x: newX, y: newY };
    setPos({ x: newX, y: newY });
  };

  const onPointerUp = () => {
    dragging.current = false;
    setTimeout(() => { isDragging.current = false; }, 50);
  };

  const onButtonClick = () => {
    if (!moved.current) {
      setOpen(prev => !prev);
    }
    moved.current = false;
  };

  if (!pos) return null;

  return (
    <div
      className="fixed z-40 flex flex-col items-end gap-2"
      style={{
        left: pos.x,
        top: pos.y,
        touchAction: "none",
      }}
    >
      {open && (
        <div className="animate-fade-up rounded-2xl border border-border bg-card shadow-2xl p-4 w-72 -translate-x-[calc(100%-56px)]">
          <p className="text-sm font-semibold text-foreground mb-1">Need Help?</p>
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            Message our support on Telegram for any issues with trades, disputes, or the platform.
          </p>
          <a
            href={TG_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-[hsl(200,80%,45%)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 active:scale-[0.97] transition-all w-full justify-center"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0h-.056zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            Chat on Telegram
          </a>
        </div>
      )}
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={onButtonClick}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl transition-shadow cursor-grab active:cursor-grabbing select-none"
        aria-label="Support"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
};

export default SupportButton;
