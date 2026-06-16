import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ScrollReveal from "@/components/ScrollReveal";
import { P2P_CONTRACT_ADDRESS } from "@/config/wagmi";

const SECTIONS = [
  {
    id: "intro",
    title: "What is Crypto P2P?",
    content: [
      "Crypto P2P is a fully decentralised peer-to-peer marketplace built on BNB Smart Chain. It allows users to transfer USDT and BNB directly with each other using Indian Rupees (INR) — without any middlemen or centralised intermediaries.",
      "Every transfer is secured by an on-chain escrow smart contract. Whether someone posts a Sell ad (locks crypto) or a Buy ad (locks INR-equivalent value as collateral concept), the funds are protected by contract logic — not by us.",
      "There are zero platform fees. The only cost is the tiny BNB gas fee for on-chain transactions, which is usually under ₹1. The platform is available on web and as an Android app.",
    ],
  },
  {
    id: "connect",
    title: "Step 1 — Connect Your Wallet",
    content: [
      "You can connect with any BNB Smart Chain wallet — MetaMask, Trust Wallet, OKX Wallet, Bitget, Binance Wallet, TokenPocket, Coinbase Wallet and more, both on desktop browsers and inside mobile wallet apps via WalletConnect.",
      "On mobile, tap \"Connect Wallet\" → choose your wallet from the bottom sheet. The platform deep-links straight into the installed app (no copying URIs). If the app isn't installed, you're sent to its download page.",
      "Your wallet address is your identity — no email, no password, no KYC. Make sure you're switched to BNB Smart Chain (Mainnet) before trading.",
    ],
  },
  {
    id: "username",
    title: "Step 1b — Set a Username (Optional)",
    content: [
      "Open the Profile page to claim a public username for your wallet. It shows up on your ads and in chat so traders see a name instead of a long 0x... address.",
      "Usernames are secured by wallet signature — when you save or change one, your wallet pops up to sign a short message. The backend verifies that signature on-chain, so only the true wallet owner can edit their own username. Nobody (not even us) can change it for you.",
      "Usernames are unique and case-insensitive. You can update yours anytime by signing again.",
    ],
  },
  {
    id: "ad-types",
    title: "Sell Ads vs Buy Ads",
    content: [
      "Sell Ads: posted by people who already hold crypto and want INR. The seller's USDT/BNB is locked in escrow up-front. Buyers browse these on the main P2P page.",
      "Buy Ads: posted by people who want to buy crypto with INR. The Buy escrow contract coordinates the matching seller delivering tokens. Sellers can browse open Buy ads and fulfil them.",
      "My Deals page is for buyers tracking their purchases. My Ads page is for sellers managing their listings. The two are kept separate to avoid confusion.",
    ],
  },
  {
    id: "browse",
    title: "Step 2 — Browse Sell Ads",
    content: [
      "The main P2P Trading page shows all active sell ads from other users. Each ad card displays the seller's wallet address, the token they're selling (USDT or BNB), the price per token in INR, and their preferred payment method.",
      "You can filter ads by cryptocurrency (USDT or BNB) using the filter buttons at the top. Ads are sorted by price so you can quickly find the best deals.",
      "Each ad also shows the total amount available and the deal timeout — how long you'll have to complete the payment after accepting.",
    ],
  },
  {
    id: "escrow",
    title: "Step 3 — How Escrow Works",
    content: [
      "When a seller creates an ad, their tokens are immediately transferred from their wallet into the escrow smart contract. This is an on-chain transaction that locks the tokens — the seller cannot withdraw them once the ad is live.",
      "When a buyer accepts a deal, the tokens remain locked. The buyer then sends INR payment directly to the seller through the chosen payment method (UPI, Bank Transfer, etc.).",
      "After the buyer confirms they've sent the payment, the seller checks their bank/UPI and confirms receipt on the platform. The smart contract then automatically releases the tokens to the buyer's wallet.",
      "This flow ensures neither party can scam the other — the seller can't run away with both crypto and INR, and the buyer's payment is tracked through the deal timeline.",
    ],
  },
  {
    id: "payment",
    title: "Step 4 — Making & Confirming Payment",
    content: [
      "Once you accept a deal as a buyer, you'll see the seller's payment details — UPI ID, bank account info, or other method-specific details. For UPI payments, a QR code is automatically generated so you can scan and pay instantly.",
      "Send the exact INR amount shown in the deal to the seller's provided payment details. Double-check the amount and account details before sending.",
      "After sending payment, click \"I Have Paid\" to notify the seller. The deal timer is ticking, so complete your payment promptly.",
      "The seller will then check their account for the incoming payment. Once they confirm receipt, the smart contract releases the crypto tokens to your wallet automatically.",
    ],
  },
  {
    id: "selling",
    title: "Step 5 — Selling Crypto",
    content: [
      "To sell crypto, click \"Sell USDT\" or \"Sell BNB\" on the P2P Trading page. A form will appear where you set your price per token (in INR), the amount you want to sell, your preferred payment method, and your payment details.",
      "Supported payment methods include UPI, Bank Transfer, Google Pay, PhonePe, Cash/Bank Deposit, Digital Rupee, PayPal, and Wise. Choose the one that works best for you.",
      "You also set a deal timeout (how long buyers have to pay) and an ad duration (how long your ad stays live). Once you submit, your tokens are locked in the escrow contract and your ad goes live.",
      "When a buyer accepts your deal and sends payment, you'll see the deal in your \"My Ads\" page. Verify the payment in your bank/UPI, then click \"Release\" to confirm and send the tokens to the buyer.",
    ],
  },
  {
    id: "disputes",
    title: "Step 6 — Disputes & Safety",
    content: [
      "Sometimes things don't go smoothly. A buyer might claim they paid when they didn't, or a seller might not release tokens after receiving payment. The dispute system handles these cases.",
      "The \"Raise Dispute\" button only becomes available after the deal timer expires. This prevents premature disputes and gives both parties enough time to complete the trade.",
      "If a buyer falsely confirms payment without actually sending money: The seller simply doesn't click \"Release.\" After the timer expires, the seller can raise a dispute. The admin reviews the case and returns the tokens to the seller.",
      "If a seller doesn't release tokens after the buyer has paid: The buyer waits for the timer to expire, then raises a dispute. The admin verifies the payment and releases the tokens to the buyer.",
      "An admin reviews all disputes and makes a fair decision based on the evidence. The smart contract then releases the locked tokens to the rightful party.",
    ],
  },
  {
    id: "deal-lifecycle",
    title: "Deal Lifecycle — From Start to Finish",
    content: [
      "1. Seller creates an ad → Tokens locked in escrow.",
      "2. Buyer accepts the deal → Deal timer starts.",
      "3. Buyer sends INR payment → Clicks \"I Have Paid.\"",
      "4. Seller verifies payment → Clicks \"Release\" to send tokens.",
      "5. Tokens released to buyer → Deal complete!",
      "If anything goes wrong at step 3 or 4, the dispute system kicks in after timeout.",
    ],
  },
  {
    id: "cancel",
    title: "Cancelling Deals & Ads",
    content: [
      "Sellers can cancel their ad at any time if no deal is active. The locked tokens are returned to their wallet.",
      "Buyers can cancel a deal before confirming payment. Once you've clicked \"I Have Paid,\" you cannot cancel — you'll need to wait for the seller or use the dispute system.",
      "If a deal times out because the buyer didn't pay, the ad automatically goes Live again with a fresh timer. The seller's tokens stay safely locked in escrow — ready for the next buyer. No action needed from the seller.",
      "The seller can always manually cancel their ad (when it's Live) to withdraw their tokens back to their wallet.",
    ],
  },
  {
    id: "fees",
    title: "Fees & Limits",
    content: [
      "Platform fees: Zero. There are no platform fees at all.",
      "Gas fees: You pay a small BNB gas fee for on-chain transactions (creating ads, accepting deals, confirming payments, etc.). This is typically under ₹1.",
      "Minimum trade: No minimum. You can trade as little as $1 worth of crypto.",
      "Maximum trade: No maximum. Sellers set their own amounts.",
      "The platform does not hold or touch your INR payments — all fiat transfers happen directly between buyer and seller.",
    ],
  },
  {
    id: "security",
    title: "Security & Trust",
    content: [
      "Smart Contract Escrow: All crypto is held in an audited smart contract on BNB Smart Chain mainnet. No human can access the locked funds — only the contract logic controls releases.",
      "No KYC Required: Your wallet is your identity. We don't collect personal information, emails, or phone numbers.",
      "On-chain Transparency: Every ad, deal, and dispute is recorded on the blockchain. Anyone can verify the contract activity on BscScan.",
      "Dispute Resolution: A trusted admin resolves disputes fairly. The dispute system is designed so that honest parties are always protected.",
      `Open Contract: The smart contract address is publicly visible and verifiable: ${P2P_CONTRACT_ADDRESS}`,
    ],
  },
  {
    id: "tips",
    title: "Tips for Safe Trading",
    content: [
      "✅ Always double-check payment details before sending INR.",
      "✅ Never send payment outside the deal — only use the details shown in your active deal.",
      "✅ Complete trades within the deal timeout to avoid issues.",
      "✅ Take screenshots of your payment as evidence in case of disputes.",
      "✅ Start with small amounts if you're new to P2P transfers.",
      "❌ Don't trust anyone asking you to cancel a deal after you've already paid.",
      "❌ Don't send crypto directly — always use the platform's escrow system.",
      "❌ Don't share your wallet private key with anyone.",
    ],
  },
  {
    id: "support",
    title: "Getting Help",
    content: [
      "If you need help with a trade, dispute, or anything else, reach out on Telegram: @Xplorertobi38",
      "You can also use the support button (chat icon) in the bottom-right corner of any page to quickly get to our Telegram support.",
      "For general questions, check the FAQ section on the homepage — it covers the most common questions about the platform.",
    ],
  },
  {
    id: "payment-profiles",
    title: "Saved Payment Profiles",
    content: [
      "The first time you create a Sell ad with payment details (UPI ID, bank account, etc.), they're saved to your wallet's private payment profile. Next time, the fields auto-fill so you don't have to retype them.",
      "Payment profiles are tied to your wallet address and can only be edited by signing with that wallet — same security model as usernames. No one else can read or modify them.",
    ],
  },
  {
    id: "notifications",
    title: "Real-time Notifications & Chat",
    content: [
      "Every deal has a built-in real-time chat with read-receipts, typing indicators and 10 MB media attachments (images, payment screenshots, etc.). Messages auto-delete after the trade closes.",
      "You'll get browser/app notifications for new deals, payments marked sent, releases, disputes and incoming chat messages — even when the tab is in the background. Permission is requested only after you start using the app, never on first load.",
      "A global unread badge in the bottom nav tells you when any of your deals has new activity.",
    ],
  },
  {
    id: "mobile-app",
    title: "Mobile App (Android)",
    content: [
      "Crypto P2P ships as a native Android app built with Capacitor. Download the APK from the homepage or install from the Play Store listing when available.",
      "The mobile app supports deep-linking into installed wallet apps (OKX, MetaMask, Trust, Bitget, Binance, TokenPocket) via WalletConnect, has safe-area-aware layouts, 44px touch targets and 16px input fields (so iOS doesn't zoom in).",
      "Push-style in-app notifications, background polling and pull-to-refresh make it feel as snappy as any chat app.",
    ],
  },
  {
    id: "news",
    title: "Crypto News Feed",
    content: [
      "The News tab shows AI-curated crypto headlines, refreshed automatically. Posts older than 4 days are purged so the feed stays current.",
      "News is informational only. Every article carries a disclaimer — we never give financial advice and you should always do your own research before trading.",
    ],
  },
  {
    id: "stats",
    title: "Transparency & Live Stats",
    content: [
      "The Transparency page shows live on-chain totals: cumulative trade volume, total completed deals and active ads — all read directly from the smart contracts. Nothing is faked or stored off-chain.",
      "You can verify every figure yourself by viewing the contract on BscScan.",
    ],
  },
];


const Guide = () => (
  <div className="min-h-screen bg-background flex flex-col">
    <Navbar />
    <main className="flex-1 mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <ScrollReveal>
        <h1
          className="text-2xl font-bold text-foreground sm:text-3xl mb-2"
          style={{ lineHeight: "1.1" }}
        >
          Complete Guide to Crypto P2P
        </h1>
        <p className="text-muted-foreground text-sm mb-4 max-w-2xl">
          Everything you need to know about using the platform — from connecting your wallet to resolving disputes. Read this once and you'll be a pro.
        </p>
      </ScrollReveal>

      {/* Table of contents */}
      <ScrollReveal delay={80}>
        <nav className="rounded-lg border border-border bg-card p-4 mb-10">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Table of Contents
          </p>
          <div className="grid gap-1 sm:grid-cols-2">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="text-sm text-primary hover:underline py-0.5"
              >
                {s.title}
              </a>
            ))}
            <a href="#walkthrough" className="text-sm text-primary hover:underline py-0.5 font-medium">
              📖 Live Example — Full Trade Walkthrough
            </a>
          </div>
        </nav>
      </ScrollReveal>

      {/* Sections */}
      <div className="space-y-14">
        {SECTIONS.map((section, i) => (
          <ScrollReveal key={section.id} delay={60}>
            <section id={section.id} className="scroll-mt-20">
              <h2
                className="text-lg font-semibold text-foreground mb-4 sm:text-xl"
                style={{ lineHeight: "1.2" }}
              >
                {section.title}
              </h2>


              <div className="space-y-3">
                {section.content.map((para, j) => (
                  <p
                    key={j}
                    className="text-sm text-muted-foreground leading-relaxed"
                  >
                    {para}
                  </p>
                ))}
              </div>
            </section>
          </ScrollReveal>
        ))}
      </div>

      {/* Step-by-step walkthrough */}
      <ScrollReveal delay={80}>
        <div className="mt-16 mb-4">
          <h2 className="text-xl font-bold text-foreground sm:text-2xl mb-2" style={{ lineHeight: "1.15" }}>
            Live Example — Full Trade Walkthrough
          </h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
            Let's follow two users — <span className="text-foreground font-medium">Ravi</span> (the seller) and <span className="text-foreground font-medium">Priya</span> (the buyer) — through a complete USDT trade from start to finish.
          </p>
        </div>
      </ScrollReveal>

      <div className="space-y-6" id="walkthrough">
        {/* Step 1 */}
        <ScrollReveal delay={60}>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-3 bg-surface-2 px-4 py-3 border-b border-border">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</div>
              <h3 className="text-sm font-semibold text-foreground">Ravi Creates a Sell Ad</h3>
              <span className="ml-auto text-[10px] font-medium text-muted-foreground bg-surface-1 px-2 py-0.5 rounded-full">SELLER SIDE</span>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">Ravi has <span className="text-foreground font-medium">50 USDT</span> in his wallet and wants to sell them for INR. He goes to the P2P Trading page and clicks <span className="text-foreground font-medium">"Sell USDT"</span>.</p>
              <div className="rounded-md bg-surface-2 p-3 text-xs space-y-1.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Token:</span><span className="text-foreground">USDT</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Amount:</span><span className="text-foreground">50 USDT</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Price:</span><span className="text-foreground">₹94 per USDT</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Payment Method:</span><span className="text-foreground">UPI</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">UPI ID:</span><span className="text-foreground">ravi@ybl</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Deal Timeout:</span><span className="text-foreground">30 minutes</span></div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">Ravi approves the USDT spend and confirms the transaction. His <span className="text-foreground font-medium">50 USDT</span> are now locked in the escrow smart contract. The ad goes live on the marketplace.</p>
              <div className="flex items-center gap-2 text-xs text-buy">
                <span className="h-1.5 w-1.5 rounded-full bg-buy animate-pulse" />
                Ravi's 50 USDT → Locked in Smart Contract
              </div>
            </div>
          </div>
        </ScrollReveal>

        {/* Step 2 */}
        <ScrollReveal delay={60}>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-3 bg-surface-2 px-4 py-3 border-b border-border">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</div>
              <h3 className="text-sm font-semibold text-foreground">Priya Browses & Accepts the Deal</h3>
              <span className="ml-auto text-[10px] font-medium text-muted-foreground bg-surface-1 px-2 py-0.5 rounded-full">BUYER SIDE</span>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">Priya wants to buy USDT. She connects her MetaMask wallet and browses the P2P Trading page. She sees Ravi's ad: <span className="text-foreground font-medium">50 USDT at ₹94/USDT via UPI</span>.</p>
              <p className="text-sm text-muted-foreground leading-relaxed">She clicks <span className="text-foreground font-medium">"Accept"</span> and enters the amount she wants to buy — let's say <span className="text-foreground font-medium">20 USDT</span> (= ₹1,880).</p>
              <p className="text-sm text-muted-foreground leading-relaxed">She confirms the on-chain transaction. The deal is now active and the <span className="text-foreground font-medium">30-minute countdown</span> begins.</p>
              <div className="flex items-center gap-2 text-xs text-amber-500">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                Deal Active — 30:00 countdown started
              </div>
            </div>
          </div>
        </ScrollReveal>

        {/* Step 3 */}
        <ScrollReveal delay={60}>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-3 bg-surface-2 px-4 py-3 border-b border-border">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</div>
              <h3 className="text-sm font-semibold text-foreground">Priya Sees Payment Details & Sends ₹1,880</h3>
              <span className="ml-auto text-[10px] font-medium text-muted-foreground bg-surface-1 px-2 py-0.5 rounded-full">BUYER SIDE</span>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">After accepting, Priya sees Ravi's payment details in her <span className="text-foreground font-medium">"My Deals"</span> page:</p>
              <div className="rounded-md bg-surface-2 p-3 text-xs space-y-1.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Pay to:</span><span className="text-foreground">Ravi Kumar</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Method:</span><span className="text-foreground">UPI</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">UPI ID:</span><span className="text-foreground font-mono">ravi@ybl</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Amount:</span><span className="text-foreground font-semibold">₹1,880</span></div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">A <span className="text-foreground font-medium">QR code</span> is also shown — Priya scans it with Google Pay, sends exactly ₹1,880 to ravi@ybl, and then clicks <span className="text-foreground font-medium">"I Have Paid"</span> on the platform.</p>
              <div className="flex items-center gap-2 text-xs text-blue-400">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                Priya confirms payment — waiting for seller
              </div>
            </div>
          </div>
        </ScrollReveal>

        {/* Step 4 */}
        <ScrollReveal delay={60}>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-3 bg-surface-2 px-4 py-3 border-b border-border">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">4</div>
              <h3 className="text-sm font-semibold text-foreground">Ravi Verifies Payment & Releases Tokens</h3>
              <span className="ml-auto text-[10px] font-medium text-muted-foreground bg-surface-1 px-2 py-0.5 rounded-full">SELLER SIDE</span>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">Ravi gets notified that Priya has marked the payment as sent. He checks his UPI app and sees <span className="text-foreground font-medium">₹1,880 received from Priya</span>.</p>
              <p className="text-sm text-muted-foreground leading-relaxed">He goes to his <span className="text-foreground font-medium">"My Ads"</span> page, finds the active deal, and clicks <span className="text-foreground font-medium">"Release"</span>. This triggers an on-chain transaction.</p>
              <p className="text-sm text-muted-foreground leading-relaxed">The smart contract verifies everything and releases <span className="text-foreground font-medium">20 USDT</span> directly to Priya's wallet.</p>
              <div className="flex items-center gap-2 text-xs text-buy">
                <span className="h-1.5 w-1.5 rounded-full bg-buy" />
                ✅ 20 USDT released to Priya's wallet
              </div>
            </div>
          </div>
        </ScrollReveal>

        {/* Step 5 */}
        <ScrollReveal delay={60}>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-3 bg-surface-2 px-4 py-3 border-b border-border">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">5</div>
              <h3 className="text-sm font-semibold text-foreground">Deal Complete!</h3>
              <span className="ml-auto text-[10px] font-medium text-muted-foreground bg-surface-1 px-2 py-0.5 rounded-full">BOTH SIDES</span>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">The deal is now complete. Here's the final summary:</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md bg-surface-2 p-3">
                  <p className="text-xs font-semibold text-foreground mb-2">🟢 Ravi (Seller)</p>
                  <div className="text-xs space-y-1 text-muted-foreground">
                    <p>• Sold 20 USDT</p>
                    <p>• Received ₹1,880 via UPI</p>
                    <p>• Remaining 30 USDT still in escrow for next buyer</p>
                  </div>
                </div>
                <div className="rounded-md bg-surface-2 p-3">
                  <p className="text-xs font-semibold text-foreground mb-2">🟢 Priya (Buyer)</p>
                  <div className="text-xs space-y-1 text-muted-foreground">
                    <p>• Bought 20 USDT</p>
                    <p>• Paid ₹1,880 via UPI</p>
                    <p>• 20 USDT now in her wallet</p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">The entire trade is recorded on the blockchain with timestamps and transaction hashes — visible in the deal timeline.</p>
            </div>
          </div>
        </ScrollReveal>

        {/* Dispute scenario */}
        <ScrollReveal delay={60}>
          <div className="mt-4 rounded-lg border border-destructive/30 bg-card overflow-hidden">
            <div className="flex items-center gap-3 bg-destructive/10 px-4 py-3 border-b border-destructive/20">
              <span className="text-sm">⚠️</span>
              <h3 className="text-sm font-semibold text-foreground">What If Something Goes Wrong?</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-foreground mb-1.5">Scenario A — Priya claims she paid, but Ravi didn't receive money</p>
                <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
                  <p>Ravi checks his UPI and doesn't see ₹1,880. He does <span className="text-foreground font-medium">NOT</span> click "Release."</p>
                  <p>The 30-minute timer expires. Ravi clicks <span className="text-foreground font-medium">"Raise Dispute."</span></p>
                  <p>An admin reviews the case. Since Priya didn't actually pay, the admin releases the 20 USDT back to Ravi.</p>
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <p className="text-xs font-semibold text-foreground mb-1.5">Scenario B — Priya paid, but Ravi won't release tokens</p>
                <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
                  <p>Priya sent ₹1,880 and has the payment screenshot. But Ravi isn't clicking "Release."</p>
                  <p>The 30-minute timer expires. Priya clicks <span className="text-foreground font-medium">"Raise Dispute."</span></p>
                  <p>An admin checks the evidence, verifies Priya's payment, and releases the 20 USDT to Priya's wallet.</p>
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <p className="text-xs font-semibold text-foreground mb-1.5">Scenario C — Priya accepted but never pays</p>
                <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
                  <p>Priya accepted the deal but doesn't send any payment and doesn't click "I Have Paid."</p>
                  <p>The 30-minute timer expires. Ravi clicks <span className="text-foreground font-medium">"Cancel Deal"</span> and his 20 USDT are returned to the escrow (available for other buyers).</p>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>

      {/* CTA */}
      <ScrollReveal delay={80}>
        <div className="mt-16 rounded-lg border border-border bg-card p-6 text-center">
          <h3 className="text-base font-semibold text-foreground mb-2">
            Ready to Start Trading?
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Connect your wallet and browse live sell ads — it takes less than a minute.
          </p>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all"
          >
            Go to P2P Trading
          </a>
        </div>
      </ScrollReveal>
    </main>
    <Footer />
  </div>
);

export default Guide;
