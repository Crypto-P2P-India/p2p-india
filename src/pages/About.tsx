import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Shield, Zap, Users, Lock, ArrowLeftRight, Clock } from "lucide-react";
import { P2P_CONTRACT_ADDRESS } from "@/config/wagmi";

const FEATURES = [
  { icon: Lock, title: "Escrow Protection", desc: "Seller tokens are locked in an audited smart contract. Funds only release when both parties confirm the trade." },
  { icon: Zap, title: "Zero Fees", desc: "No platform fees at all. You only pay the tiny BNB gas fee (usually under $0.01) for on-chain transactions." },
  { icon: ArrowLeftRight, title: "Direct P2P Transfers", desc: "Transfer USDT and BNB directly wallet-to-wallet. Fully decentralised marketplace with no intermediaries." },
  { icon: Users, title: "Indian Payment Methods", desc: "Pay with UPI (GPay, PhonePe, Paytm) or Bank Transfer (NEFT/IMPS). Sellers choose their preferred method." },
  { icon: Clock, title: "Timed Deals", desc: "Every deal has a countdown. If the buyer doesn't pay in time, the seller reclaims their tokens automatically." },
  { icon: Shield, title: "Dispute Resolution", desc: "If something goes wrong, either party can raise an on-chain dispute. An admin reviews and resolves it fairly." },
];

const STEPS = [
  { n: "1", title: "Connect Wallet", desc: "Connect any BNB Smart Chain wallet — MetaMask, Trust Wallet, Coinbase Wallet, etc." },
  { n: "2", title: "Browse or Post", desc: "Browse live sell ads sorted by price, or post your own ad with your preferred payment method and price." },
  { n: "3", title: "Accept a Deal", desc: "Found a good price? Accept the deal. The seller's tokens are already locked in escrow — safe for you." },
  { n: "4", title: "Send Payment", desc: "Send INR to the seller via UPI or Bank Transfer. Mark payment as sent on the platform." },
  { n: "5", title: "Seller Confirms", desc: "The seller verifies payment receipt and confirms on-chain. The smart contract releases tokens to your wallet." },
];

const About = () => (
  <div className="min-h-screen bg-background flex flex-col">
    <Navbar />
    <main className="flex-1 mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-foreground sm:text-3xl mb-2" style={{ lineHeight: "1.1" }}>
        About Crypto P2P
      </h1>
      <p className="text-muted-foreground text-sm mb-10 max-w-xl">
        A fully decentralised peer-to-peer marketplace built on BNB Smart Chain. Transfer crypto directly between users — secured by smart contract escrow.
      </p>

      {/* Features */}
      <h2 className="text-lg font-semibold text-foreground mb-4">What the contract does</h2>
      <div className="grid gap-4 sm:grid-cols-2 mb-12">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <f.icon className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-sm font-medium text-foreground">{f.title}</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* How it works */}
      <h2 className="text-lg font-semibold text-foreground mb-4">How it works</h2>
      <div className="space-y-4 mb-12">
        {STEPS.map((s) => (
          <div key={s.n} className="flex gap-4 items-start">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
              {s.n}
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground">{s.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Contract */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium text-foreground mb-1">Smart Contract</h3>
        <p className="text-xs text-muted-foreground mb-2">
          All transfers are secured by our escrow contract deployed on BNB Smart Chain mainnet.
        </p>
        <a
          href={`https://bscscan.com/address/${P2P_CONTRACT_ADDRESS}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline font-mono break-all"
        >
          {P2P_CONTRACT_ADDRESS}
        </a>
      </div>

      {/* Support */}
      <div className="rounded-lg border border-border bg-card p-4 mt-4">
        <h3 className="text-sm font-medium text-foreground mb-1">Support</h3>
        <p className="text-xs text-muted-foreground mb-2">
          Need help with a deal, dispute, or anything else? Reach out on Telegram.
        </p>
        <a
          href="https://t.me/Xplorertobi38"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline"
        >
          @Xplorertobi38 on Telegram →
        </a>
      </div>
    </main>
    <Footer />
  </div>
);

export default About;
