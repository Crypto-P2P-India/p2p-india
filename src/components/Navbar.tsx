import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Link } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";

const Navbar = () => {
  return (
    <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-2xl">
      {/* Safe area spacer for mobile notch */}
      <div className="h-[env(safe-area-inset-top)] bg-background/80" />
      <div className="mx-auto flex h-16 sm:h-[4.5rem] max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3">
          <div className="relative h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center overflow-hidden border border-primary/10 shadow-sm">
            <img src="/favicon.png" alt="Crypto P2P" className="h-7 w-7 sm:h-8 sm:w-8" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground leading-tight">
              Crypto P2P
            </span>
            <span className="text-[9px] sm:text-[10px] font-semibold text-primary/70 leading-none tracking-[0.15em] uppercase">
              Peer to Peer Trading
            </span>
          </div>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <ConnectButton chainStatus="icon" accountStatus="address" showBalance={false} />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
