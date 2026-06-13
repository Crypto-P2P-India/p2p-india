import { ExternalLink, Zap, Lock, ShieldCheck, Link2 } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import ScrollReveal from "@/components/ScrollReveal";

const HIGHLIGHTS = [
  { icon: Zap, title: "Zero Fees", sub: "No commissions on trades" },
  { icon: Lock, title: "Non-Custodial", sub: "Your keys, your crypto" },
  { icon: ShieldCheck, title: "Escrow Secured", sub: "Smart contract holds funds" },
  { icon: Link2, title: "BNB Smart Chain", sub: "Fully on-chain, verified" },
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
    {/* Hero — compact, Binance-clean */}
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.05] via-transparent to-transparent pointer-events-none" />
      <div className="mx-auto max-w-7xl px-5 pt-12 pb-10 sm:px-6 sm:pt-20 sm:pb-16 relative">
        <ScrollReveal duration={600}>
          <div className="max-w-2xl">
            <h1
              className="text-3xl font-extrabold text-foreground sm:text-5xl tracking-tight"
              style={{ lineHeight: "1.05", textWrap: "balance" }}
            >
              Secure <span className="text-primary">P2P</span>
              <br className="sm:hidden" /> Marketplace
            </h1>
            <p className="mt-4 text-sm sm:text-base text-muted-foreground max-w-md leading-relaxed">
              Zero fees. Full custody. Smart contract escrow for every deal.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={scrollToAds}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/10 active:scale-[0.98] transition-transform"
              >
                Browse Ads
              </button>
              <ConnectButton />
              <a
                href="https://bscscan.com/address/0xd79ef02e1F64EF4368b942020129bd0Bc7da0d95"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                View Contract
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </ScrollReveal>

        {/* Highlight strip — 2x2 on mobile, 4-up on desktop */}
        <div className="mt-10 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          {HIGHLIGHTS.map((h, i) => (
            <ScrollReveal key={h.title} delay={80 + i * 60} duration={500}>
              <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm p-3.5 transition-colors hover:border-primary/20">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 mb-2.5">
                  <h.icon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-xs font-bold text-foreground">{h.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{h.sub}</p>
              </div>
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
