import { ExternalLink, Zap, Lock, ShieldCheck, Link2 } from "lucide-react";
import { Link } from "react-router-dom";
import ScrollReveal from "@/components/ScrollReveal";
import { P2P_CONTRACT_ADDRESS } from "@/config/wagmi";

const HIGHLIGHTS = [
  { icon: Zap, title: "0% Platform Fee", sub: "We charge nothing on buys or sells. You only pay tiny BSC network gas (~₹2–₹10). See full breakdown.", glow: true, href: "/transparency" },
  { icon: Lock, title: "Non-Custodial", sub: "Your keys, your crypto. Funds only locked in transparent smart contracts.", href: "/transparency" },
  { icon: ShieldCheck, title: "Smart Escrow", sub: "Automated protection for both buyers and sellers using on-chain logic.", href: "/transparency" },
  { icon: Link2, title: "BNB Smart Chain", sub: "Fully on-chain, verifiable, and lightning-fast settlement.", href: "/transparency" },
];

const STEPS = [
  { n: "1", title: "Connect Wallet", desc: "Use MetaMask, Trust, OKX or any BNB-compatible wallet." },
  { n: "2", title: "Browse Ads", desc: "Live ads sorted by best price. Pick what fits you." },
  { n: "3", title: "Pay & Confirm", desc: "Send INR via UPI / bank. Tokens stay locked in escrow." },
  { n: "4", title: "Receive Crypto", desc: "Seller confirms. Contract releases tokens to you." },
];

const scrollToAds = () => {
  document.getElementById("live-ads")?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const LandingHero = () => (
  <>
    {/* Hero — premium obsidian-glass, centered */}
    <section className="relative overflow-hidden">
      {/* Decorative emerald glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 blur-[120px] rounded-full" />

      <div className="relative mx-auto max-w-7xl px-5 pt-14 pb-16 sm:px-6 sm:pt-24 sm:pb-24">
        <div className="flex flex-col items-center text-center">
          <ScrollReveal duration={600}>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Secured by Smart Contracts
            </div>
          </ScrollReveal>

          <ScrollReveal delay={80} duration={600}>
            <h1
              className="mt-6 max-w-4xl text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-foreground"
              style={{ lineHeight: "1.05", textWrap: "balance" }}
            >
              Secure{" "}
              <span className="bg-gradient-to-r from-primary to-teal-300 bg-clip-text text-transparent">
                P2P
              </span>{" "}
              Marketplace
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={140} duration={600}>
            <p className="mt-5 max-w-2xl text-sm sm:text-lg leading-relaxed text-muted-foreground">
              Trade crypto directly with other users with zero fees. Full custody, decentralized escrow, and lightning-fast settlement.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={200} duration={600}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <button
                onClick={scrollToAds}
                className="rounded-xl bg-primary px-6 sm:px-8 py-3.5 sm:py-4 text-sm sm:text-base font-bold text-primary-foreground shadow-xl shadow-primary/10 transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]"
              >
                Browse Ads
              </button>
              
              <a
                href={`https://bscscan.com/address/${P2P_CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                View Contract
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </ScrollReveal>
        </div>

        {/* Highlight cards */}
        <div className="mt-16 sm:mt-24 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {HIGHLIGHTS.map((h, i) => (
            <ScrollReveal key={h.title} delay={80 + i * 60} duration={500}>
              <Link to={h.href} className="block h-full">
                <div className="group relative h-full overflow-hidden rounded-2xl border border-border/40 bg-card/30 backdrop-blur-sm p-5 sm:p-7 transition-all hover:border-primary/30 hover:bg-card/50">
                  {h.glow && (
                    <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-primary/10 blur-3xl transition-all group-hover:bg-primary/20" />
                  )}
                  <div className="relative mb-4 sm:mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <h.icon className="h-5 w-5" />
                  </div>
                  <h3 className="relative text-base sm:text-lg font-bold text-foreground">{h.title}</h3>
                  <p className="relative mt-1.5 text-xs sm:text-sm leading-relaxed text-muted-foreground">{h.sub}</p>
                </div>
              </Link>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>

    {/* How it works — compact */}
    <section className="mx-auto max-w-7xl px-5 pb-12 sm:px-6 sm:pb-16">
      <ScrollReveal>
        <h2 className="text-lg sm:text-2xl font-extrabold text-foreground mb-1 tracking-tight">
          How it works
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground mb-6">
          Four steps from wallet to crypto in your hands.
        </p>
      </ScrollReveal>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 sm:gap-3">
        {STEPS.map((s, i) => (
          <ScrollReveal key={s.n} delay={i * 80} duration={500}>
            <div className="rounded-2xl border border-border/60 bg-card/40 p-4 h-full hover:border-primary/20 transition-colors">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 mb-2">
                <span className="text-[11px] font-bold text-primary">{s.n}</span>
              </div>
              <h3 className="text-xs font-bold text-foreground mb-1">{s.title}</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>

    {/* Anchor target for Browse Ads CTA */}
    <div id="live-ads" className="h-0" />
  </>
);

export default LandingHero;
