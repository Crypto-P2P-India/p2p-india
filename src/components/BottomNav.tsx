import { useLocation, Link } from "react-router-dom";
import { ArrowLeftRight, PlusCircle, ShoppingBag, Handshake } from "lucide-react";
import { useAccount } from "wagmi";
import { useGlobalUnreadCount } from "@/hooks/useGlobalUnreadCount";
import { isNativeApp } from "@/lib/platform";

const NAV_ITEMS = [
  { label: "P2P", href: "/", icon: ArrowLeftRight },
  { label: "My Ads", href: "/my-ads", icon: ShoppingBag },
  { label: "", href: "/create", icon: PlusCircle, isCenter: true },
  { label: "Deals", href: "/my-orders", icon: Handshake },
];

const BottomNav = () => {
  const location = useLocation();
  const { address } = useAccount();
  const unreadCount = useGlobalUnreadCount(address);

  // Hide bottom nav inside the native app — navigation lives in the side drawer.
  if (isNativeApp()) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/95 backdrop-blur-2xl md:hidden">
      <div className="flex items-end justify-around px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.href ||
            (item.href === "/create" && false);
          const Icon = item.icon;

          if (item.isCenter) {
            return (
              <button
                key="create"
                className="relative -mt-6 flex flex-col items-center"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("open-create-modal"));
                }}
              >
                <span className="flex h-[3.5rem] w-[3.5rem] items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-xl shadow-primary/30 active:scale-95 transition-transform border-4 border-background">
                  <PlusCircle className="h-6 w-6 text-primary-foreground" strokeWidth={2.5} />
                </span>
              </button>
            );
          }

          const showBadge = item.href === "/my-orders" && unreadCount > 0;

          return (
            <Link
              key={item.href}
              to={item.href}
              className={`relative flex flex-col items-center gap-1 px-3 py-2 min-w-[56px] transition-all ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground active:text-foreground"
              }`}
            >
              <div className="relative">
                <Icon className={`h-[22px] w-[22px] transition-transform ${isActive ? "scale-110" : ""}`} strokeWidth={isActive ? 2.5 : 1.8} />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground shadow-sm">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] leading-none ${isActive ? "font-bold" : "font-medium"}`}>
                {item.label}
              </span>
              {isActive && (
                <span className="absolute -top-[1px] left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
