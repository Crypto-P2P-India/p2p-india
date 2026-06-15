import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import { APP_VERSION, APP_SIZE } from "@/lib/platform";
import { P2P_CONTRACT_ADDRESS } from "@/config/wagmi";

const Footer = () => (
  <footer className="border-t border-border bg-surface-1 mt-12 safe-bottom">
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="grid gap-8 sm:grid-cols-3">
        {/* Brand */}
        <div>
          <Link to="/" className="flex items-center gap-2 text-lg font-bold text-primary mb-2">
            <img src="/favicon.png" alt="Crypto P2P" className="h-6 w-6" />
            Crypto P2P
          </Link>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mb-4">
            Decentralised peer-to-peer crypto marketplace on BNB Smart Chain. Zero fees, smart contract escrow, no middlemen.
          </p>
          <a
            href={`https://github.com/Crypto-P2P-India/p2p-india/releases/download/v${APP_VERSION}/crypto-p2p-v${APP_VERSION}.apk?t=${APP_VERSION}`}
            target="_blank"
            rel="noopener noreferrer"
            download={`crypto-p2p-v${APP_VERSION}.apk`}
            className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Download Android APK · v{APP_VERSION} · {APP_SIZE}
          </a>


        </div>

        {/* Quick Links */}
        <div>
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Platform</h4>
          <ul className="space-y-2">
            <li><Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">P2P Marketplace</Link></li>
            <li><Link to="/my-ads" className="text-sm text-muted-foreground hover:text-foreground transition-colors">My Ads</Link></li>
            <li><Link to="/my-orders" className="text-sm text-muted-foreground hover:text-foreground transition-colors">My Deals</Link></li>
            <li><Link to="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">About</Link></li>
            <li><Link to="/guide" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Complete Guide</Link></li>
          </ul>
        </div>

        {/* Legal & Support */}
        <div>
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Legal & Support</h4>
          <ul className="space-y-2">
            <li><Link to="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Terms & Conditions</Link></li>
            <li><Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link></li>
            <li>
              <a href="https://t.me/Xplorertobi38" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Telegram Support
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-8 border-t border-border pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Crypto P2P. All rights reserved.
        </p>
        <p className="text-xs text-muted-foreground">
          Smart Contract:{" "}
          <a
            href={`https://bscscan.com/address/${P2P_CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-mono"
          >
            {P2P_CONTRACT_ADDRESS.slice(0, 6)}…{P2P_CONTRACT_ADDRESS.slice(-4)}
          </a>
        </p>
      </div>
    </div>
  </footer>
);

export default Footer;
