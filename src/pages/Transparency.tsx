import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, ShieldCheck, AlertTriangle, Lock, Coins, Cpu, FileCode, Users, LifeBuoy, HelpCircle, CheckCircle2, XCircle } from "lucide-react";
import { P2P_CONTRACT_ADDRESS } from "@/config/wagmi";
import { BUY_ESCROW_ADDRESS } from "@/config/buyEscrowAbi";

const SUPPORT_TG = "https://t.me/Xplorertobi38";

const Section = ({ icon: Icon, title, children }: any) => (
  <section className="rounded-2xl border border-border bg-card/40 p-5 sm:p-7">
    <div className="flex items-center gap-2.5 mb-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <h2 className="text-lg sm:text-xl font-bold text-foreground">{title}</h2>
    </div>
    <div className="text-sm text-muted-foreground leading-relaxed space-y-3">{children}</div>
  </section>
);

const Pill = ({ tone = "primary", children }: { tone?: "primary" | "buy" | "sell" | "muted"; children: any }) => {
  const cls =
    tone === "buy" ? "bg-buy/10 text-buy border-buy/20"
    : tone === "sell" ? "bg-sell/10 text-sell border-sell/20"
    : tone === "muted" ? "bg-surface-3 text-muted-foreground border-border"
    : "bg-primary/10 text-primary border-primary/20";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
};

const useFetchText = (url: string) => {
  const [text, setText] = useState<string>("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    fetch(url).then(r => r.text()).then(t => { if (alive) { setText(t); setLoading(false); } }).catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [url]);
  return { text, loading };
};

const ContractViewer = ({ label, path }: { label: string; path: string }) => {
  const { text, loading } = useFetchText(path);
  return (
    <div className="rounded-lg border border-border bg-surface-1">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <span className="text-xs font-semibold text-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground font-mono">{loading ? "…" : `${text.split("\n").length} lines`}</span>
      </div>
      <pre className="overflow-x-auto p-4 text-[11px] leading-relaxed text-foreground font-mono max-h-[480px]">
        {loading ? "Loading contract source…" : text}
      </pre>
    </div>
  );
};

const Transparency = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 space-y-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary mb-4">
            <ShieldCheck className="h-3 w-3" /> Transparency & Trust
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">How Crypto P2P really works</h1>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground">
            Real fees, full smart-contract walkthrough, every scenario, admin powers, and what happens if something goes wrong — all in one place.
          </p>
        </div>

        {/* FEES */}
        <Section icon={Coins} title="Fees — exactly what you pay">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-2"><Pill tone="buy">Platform fee</Pill></div>
              <p className="text-2xl font-bold text-primary">0.25% total</p>
              <p className="text-xs mt-1"><b>0.15%</b> from the ad <b>creator</b> + <b>0.10%</b> from the <b>acceptor</b>. Charged in USDT/BNB on-chain, <b>only when the deal completes successfully</b>. Cancelled, expired, or disputed-back-to-original-owner deals → fee is <b>fully refunded</b>.</p>
            </div>
            <div className="rounded-lg border border-sell/20 bg-sell/5 p-4">
              <div className="flex items-center gap-2 mb-2"><Pill tone="sell">Network gas</Pill></div>
              <p className="text-2xl font-bold text-sell">~ ₹2 – ₹10</p>
              <p className="text-xs mt-1">Paid in BNB to the BNB Smart Chain network, <b>not to us</b>. Typical actions cost &lt; 0.0005 BNB each.</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface-1 p-4 space-y-2 text-xs">
            <h4 className="text-foreground font-semibold text-sm">How the 0.25% fee works</h4>
            <ul className="list-disc pl-4 space-y-1.5">
              <li><b>Ad creator (0.15%)</b> — locked upfront together with the trade amount when the ad is posted. If the ad is cancelled or never accepted, the full 0.15% is returned with the principal.</li>
              <li><b>Deal acceptor (0.10%)</b> — locked upfront when the deal is opened. If the deal expires, is cancelled, or resolved back to the acceptor, the 0.10% is returned.</li>
              <li><b>Trigger</b> — fees are deducted by the contract only at the moment of successful release (seller calls <code className="text-primary">confirmReceived()</code> / <code className="text-primary">release()</code>).</li>
              <li><b>Worked example</b> — 100 USDT deal: creator deposits 100.15 USDT, acceptor deposits 100.10 USDT. On success → 0.25 USDT goes to platform, both sides receive their net trade amount. On failure → both get every cent back.</li>
            </ul>
          </div>

          <div>
            <h4 className="text-foreground font-semibold mb-2">When fees & gas apply (per action)</h4>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-surface-2 text-muted-foreground">
                  <tr>
                    <th className="text-left p-2.5">Who</th>
                    <th className="text-left p-2.5">Action</th>
                    <th className="text-left p-2.5">Gas?</th>
                    <th className="text-left p-2.5">Platform fee?</th>
                  </tr>
                </thead>
                <tbody className="text-foreground">
                  {[
                    ["Seller", "Create sell ad (locks USDT + 0.15% fee)", "Yes", "0.15% locked, refunded if not used"],
                    ["Seller", "Cancel ad (unlocks USDT)", "Yes", "0.15% refunded"],
                    ["Seller", "Release USDT to buyer (success)", "Yes", "0.15% taken now"],
                    ["Seller", "Reclaim expired deal", "Yes", "0.15% refunded"],
                    ["Buyer", "Accept ad / open deal (locks 0.10% fee)", "Yes", "0.10% locked, refunded if not used"],
                    ["Buyer", "Create buy ad (locks reserve + 0.15% fee)", "Yes", "0.15% locked, refunded if not used"],
                    ["Buyer", "Mark paid", "Yes", "No"],
                    ["Buyer", "Cancel deal (timeout / mutual)", "Yes", "0.10% refunded"],
                    ["Acceptor", "On successful release", "—", "0.10% taken now"],
                    ["Either", "Open dispute", "Yes", "Fee only moves if dispute is resolved"],
                    ["Either", "Chat / send images", "No (off-chain)", "No"],
                  ].map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-2.5">{r[0]}</td>
                      <td className="p-2.5">{r[1]}</td>
                      <td className="p-2.5">{r[2]}</td>
                      <td className="p-2.5"><span className="text-primary font-semibold">{r[3]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] mt-2">Gas estimates assume 1 BNB ≈ ₹50,000 and typical BSC gwei pricing. Actual cost shown by your wallet at signing. Platform fee is enforced by the smart contract — we cannot change it per-deal or take more than 0.25% total.</p>
          </div>
        </Section>

        {/* FLOW */}
        <Section icon={Cpu} title="Full trade flow — step by step">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-surface-1 p-4">
              <h4 className="text-foreground font-semibold mb-2 flex items-center gap-2"><Pill tone="sell">Sell ad flow</Pill></h4>
              <ol className="list-decimal pl-4 space-y-1.5 text-xs">
                <li>Seller approves USDT &amp; calls <code className="text-primary">createAd()</code> — USDT moves into the contract.</li>
                <li>Buyer calls <code className="text-primary">openDeal(adId, amount)</code> — that slice is locked.</li>
                <li>Buyer sends INR off-chain (UPI / bank).</li>
                <li>Buyer calls <code className="text-primary">buyerConfirmPaid()</code>.</li>
                <li>Seller verifies bank credit and calls <code className="text-primary">confirmReceived()</code> — contract releases USDT to buyer.</li>
                <li>If buyer never pays, after timeout seller calls <code className="text-primary">sellerReclaimExpired()</code> and gets USDT back.</li>
              </ol>
            </div>
            <div className="rounded-lg border border-border bg-surface-1 p-4">
              <h4 className="text-foreground font-semibold mb-2 flex items-center gap-2"><Pill tone="buy">Buy ad flow</Pill></h4>
              <ol className="list-decimal pl-4 space-y-1.5 text-xs">
                <li>Buyer posts a buy ad — sets rate, total USDT wanted, INR payment details.</li>
                <li>Seller calls <code className="text-primary">acceptBuyAd(adId, amount)</code> — seller's USDT locks in the contract.</li>
                <li>Buyer sends INR to seller off-chain, then calls <code className="text-primary">markPaid()</code>.</li>
                <li>Seller verifies and calls <code className="text-primary">release()</code> — buyer receives USDT.</li>
                <li>If buyer never marks paid, after timeout seller calls <code className="text-primary">reclaimExpired()</code> and gets USDT back.</li>
                <li>If buyer marked paid but seller refuses to release, after a 15-minute grace either party calls <code className="text-primary">openDispute()</code> → admin reviews.</li>
              </ol>
            </div>
          </div>
        </Section>

        {/* SCENARIOS */}
        <Section icon={AlertTriangle} title="What if… every scenario covered">
          <Accordion type="multiple" className="w-full">
            {[
              {
                q: "Buyer sends INR but seller refuses to release USDT",
                a: "Buyer marks paid on-chain. After a 15-minute grace window the buyer (or seller) can call openDispute(). The deal freezes and admin reviews chat + payment proof. Admin can route funds to whichever party the evidence supports. Seller cannot withdraw the locked USDT during a dispute.",
                tone: "sell",
              },
              {
                q: "Buyer never sends INR after opening a deal",
                a: "After the pay window expires (15 min – 2 h, set by ad), the seller calls sellerReclaimExpired() (sell ads) or reclaimExpired() (buy ads). USDT instantly returns to the seller's wallet. No admin needed.",
                tone: "primary",
              },
              {
                q: "Buyer marks paid but actually didn't pay",
                a: "Seller checks bank/UPI — sees nothing. Seller does NOT release. After 15-min grace the seller calls openDispute(). Buyer must provide bank reference / screenshot in chat. If buyer has no proof, admin returns USDT to seller.",
                tone: "primary",
              },
              {
                q: "Seller goes offline after buyer paid",
                a: "After the seller-confirm window ends and the 15-min grace passes, buyer opens a dispute. Funds stay safe inside the contract — seller cannot pull them out. Admin reviews and releases USDT to the buyer if INR transfer is verified.",
                tone: "sell",
              },
              {
                q: "Either party loses internet mid-trade",
                a: "Nothing breaks. All state lives on BSC. When they come back the same buttons appear (Mark Paid / Release / Dispute) based on on-chain status. Timers continue counting from on-chain timestamps.",
                tone: "muted",
              },
              {
                q: "Smart contract gets hacked",
                a: "Contracts are open source and immutable — once deployed nobody can change the logic. Funds are locked per-ad/per-deal in isolated balances. There is no global withdraw() function. Even the admin cannot drain the contract; admin can only resolve disputed deals to one of the two existing parties.",
                tone: "buy",
              },
              {
                q: "Can the admin steal my money?",
                a: "No. Admin powers are strictly limited to: (1) resolving a disputed deal — sending the locked amount to either the buyer or the seller of that deal, and (2) updating the admin address. Admin CANNOT call createAd / openDeal / cancel on your behalf, CANNOT move funds outside the two deal participants, and CANNOT touch ads that are not in dispute status.",
                tone: "buy",
              },
              {
                q: "What happens if the website goes down?",
                a: "Your funds are not on the website — they're in the BSC smart contract. You can interact with the contract directly via BscScan's 'Write Contract' tab using your wallet. Every function (cancel, release, dispute, reclaim) is callable without the UI.",
                tone: "buy",
              },
              {
                q: "What if the BNB network is congested?",
                a: "Your TX may take longer or need a higher gas price. Funds remain locked safely. Timers use on-chain block.timestamp so a delayed mine just delays your TX, not the deal logic.",
                tone: "muted",
              },
              {
                q: "Can I get a refund after deal completes?",
                a: "No. Once confirmReceived / release is called, USDT leaves the contract and is the buyer's. Off-chain INR disputes after that point are between you and your bank — chargebacks do not reverse on-chain transfers.",
                tone: "sell",
              },
            ].map((s, i) => (
              <AccordionItem key={i} value={`s-${i}`}>
                <AccordionTrigger className="text-left text-sm">
                  <span className="flex items-center gap-2">
                    <Pill tone={s.tone as any}>Scenario</Pill> {s.q}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{s.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Section>

        {/* ADMIN POWERS */}
        <Section icon={Users} title="Who controls what">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-border bg-surface-1 p-4">
              <div className="flex items-center gap-2 mb-2"><Lock className="h-4 w-4 text-primary" /><h4 className="text-foreground font-semibold text-sm">You (User)</h4></div>
              <ul className="text-xs space-y-1 list-disc pl-4">
                <li>Full custody — only your wallet signs.</li>
                <li>Create, cancel, accept ads.</li>
                <li>Confirm payment / release.</li>
                <li>Open dispute, reclaim expired.</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-surface-1 p-4">
              <div className="flex items-center gap-2 mb-2"><ShieldCheck className="h-4 w-4 text-buy" /><h4 className="text-foreground font-semibold text-sm">Smart Contract</h4></div>
              <ul className="text-xs space-y-1 list-disc pl-4">
                <li>Holds escrowed USDT per-deal.</li>
                <li>Enforces timeouts.</li>
                <li>Immutable — code cannot change.</li>
                <li>No global withdraw exists.</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-surface-1 p-4">
              <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4 text-sell" /><h4 className="text-foreground font-semibold text-sm">Admin</h4></div>
              <ul className="text-xs space-y-1 list-disc pl-4">
                <li>Only acts on <b>disputed</b> deals.</li>
                <li>Resolves to buyer or seller of that deal.</li>
                <li>Cannot drain contract.</li>
                <li>Cannot cancel healthy deals.</li>
              </ul>
            </div>
          </div>
        </Section>

        {/* CONTRACT FUNCTIONS */}
        <Section icon={FileCode} title="Contract functions in plain English">
          <Accordion type="multiple" className="w-full">
            {[
              ["createAd(token, amount, price, payInfo, payWindow, minFill)", "Seller locks USDT and publishes a sell offer. USDT transfers from your wallet into the contract balance, tagged to this ad."],
              ["openDeal(adId, amount)", "Buyer claims a slice of an ad. That portion of USDT is moved from the ad's free balance into a locked deal balance with a deadline."],
              ["buyerConfirmPaid(dealId)", "Buyer attests on-chain that INR has been sent. Starts the seller-confirm window."],
              ["confirmReceived(dealId)", "Seller confirms INR received. USDT instantly transfers from contract to buyer."],
              ["sellerReclaimExpired(dealId)", "If buyer never confirmed paid by the deadline, seller pulls the locked USDT back into the ad's free balance (or wallet)."],
              ["raiseDispute(dealId)", "Either party flags the deal. Status becomes Disputed — no party can move funds until admin resolves."],
              ["resolveDispute(dealId, toBuyer)", "Admin-only. Pushes the disputed USDT to either the buyer or the seller of that specific deal. No third address is possible."],
              ["cancelAd(adId)", "Seller withdraws the unfilled portion of their ad back to their wallet. Cannot cancel the locked portion of an active deal."],
              ["createBuyAd(...)", "Buy-side variant — buyer publishes desired USDT and rate. Seller accepts by locking USDT into the contract."],
              ["markPaid(dealId) / release(dealId)", "Buy-escrow equivalents of buyerConfirmPaid / confirmReceived."],
              ["reclaimExpired(adId | dealId)", "After the ad/deal expiry timestamp passes with no fill, original funder reclaims funds."],
            ].map(([fn, desc], i) => (
              <AccordionItem key={i} value={`f-${i}`}>
                <AccordionTrigger className="text-left text-sm font-mono text-primary">{fn}</AccordionTrigger>
                <AccordionContent className="text-sm">{desc}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Section>

        {/* CONTRACT SOURCE */}
        <Section icon={FileCode} title="Full Solidity source code">
          <p>Both contracts are verified on BscScan. You can read every line below or open them on-chain.</p>
          <div className="flex flex-wrap gap-2">
            <a href={`https://bscscan.com/address/${P2P_CONTRACT_ADDRESS}#code`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
              Sell Escrow on BscScan <ExternalLink className="h-3 w-3" />
            </a>
            <a href={`https://bscscan.com/address/${BUY_ESCROW_ADDRESS}#code`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
              Buy Escrow on BscScan <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="sell">
              <AccordionTrigger className="text-sm">SellEscrowV6.sol — full source</AccordionTrigger>
              <AccordionContent>
                <ContractViewer label="SellEscrowV6.sol" path="/contracts/SellEscrowV6.sol" />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="buy">
              <AccordionTrigger className="text-sm">BuyEscrowV1.sol — full source</AccordionTrigger>
              <AccordionContent>
                <ContractViewer label="BuyEscrowV1.sol" path="/contracts/BuyEscrowV1.sol" />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Section>

        {/* AFTER DEPLOY */}
        <Section icon={CheckCircle2} title="What happens after the contract is deployed">
          <ul className="list-disc pl-5 space-y-1.5 text-sm">
            <li>The contract bytecode is permanent on BSC — <b>nobody can patch, pause, or upgrade it</b>.</li>
            <li>Admin address is set once at deploy. It can be rotated to a multi-sig or burnt to <code>0x0</code> to remove dispute resolution entirely (then disputed funds would stay locked — by design we keep admin alive for user safety).</li>
            <li>If this site shuts down, your funds and the contract keep working. You can call every function via BscScan with your wallet.</li>
            <li>All transactions are public and auditable — anyone can verify totals, deal history, and admin actions.</li>
          </ul>
        </Section>

        {/* SUPPORT */}
        <Section icon={LifeBuoy} title="Need help? Contact support">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm text-foreground">
              Reach us on Telegram for disputes, refund issues, or any question — usually replied within minutes.
            </p>
            <a href={SUPPORT_TG} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90">
              <HelpCircle className="h-4 w-4" /> Open Telegram Support
            </a>
            <p className="mt-3 text-xs text-muted-foreground">
              Tip: include your wallet address and the deal ID (visible on your My Deals / My Ads page) for fastest resolution.
            </p>
          </div>
          <p className="text-xs">
            Looking for the basics first? Read the <Link to="/guide" className="text-primary hover:underline">Complete Guide</Link> or <Link to="/about" className="text-primary hover:underline">About</Link> page.
          </p>
        </Section>
      </main>
      <Footer />
    </div>
  );
};

export default Transparency;
