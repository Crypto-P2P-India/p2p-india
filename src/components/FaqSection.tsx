import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import ScrollReveal from "@/components/ScrollReveal";

const FAQS = [
  {
    q: "What is Crypto P2P?",
    a: "Crypto P2P is a decentralised peer-to-peer marketplace on BNB Smart Chain. It lets you transfer USDT & BNB directly with other users — no middlemen, no centralised intermediary.",
  },
  {
    q: "How does the escrow smart contract work?",
    a: "When a seller posts an ad, their tokens are locked inside our audited escrow contract. Once a buyer accepts the deal and sends INR payment, the seller confirms receipt and the contract releases the tokens to the buyer. Neither party can run away with the funds.",
  },
  {
    q: "What payment methods are supported?",
    a: "We support UPI (Google Pay, PhonePe, Paytm), Bank Transfer (NEFT/IMPS), Cash/Bank Deposit (deposit cash at bank branch or ATM), Digital Rupee (e₹), PayPal, and Wise. The seller chooses their preferred method when creating an ad.",
  },
  {
    q: "Are there any fees?",
    a: "There are zero platform fees. You only pay the standard BNB Smart Chain gas fee for on-chain transactions, which is typically less than $0.01.",
  },
  {
    q: "What happens if the buyer doesn't pay?",
    a: "Each deal has a time limit. If the buyer doesn't mark payment within the deadline, the seller can cancel the deal and reclaim their tokens from the escrow contract.",
  },
  {
    q: "What if a buyer confirms payment without actually sending money?",
    a: "The seller's tokens stay locked in escrow until the seller manually confirms they received the payment. If the buyer falsely claims they paid, the seller simply doesn't confirm. After the deal timer expires, the seller can raise a dispute and an admin will review the case and release funds back to the seller.",
  },
  {
    q: "What happens if the seller doesn't release tokens after I pay?",
    a: "If you've sent the payment and the seller isn't confirming, wait for the deal timer to expire. Once it does, you can raise an on-chain dispute. The admin will review the evidence and release the tokens to you if your payment is verified.",
  },
  {
    q: "What happens if there's a dispute?",
    a: "After the deal timer expires, either party can raise an on-chain dispute. An admin reviews the evidence and resolves it by releasing funds to the rightful party.",
  },
  {
    q: "Can a seller withdraw tokens while a deal is active?",
    a: "No. Once a buyer accepts a deal, the seller's tokens are locked in the smart contract. The seller cannot withdraw, transfer, or access those tokens until the deal is completed, cancelled, or resolved by an admin.",
  },
  {
    q: "What if both the buyer and seller go inactive?",
    a: "The deal timer will expire. After that, either party can cancel or raise a dispute. If nobody acts, the tokens remain safely locked in escrow — they're never lost.",
  },
  {
    q: "Can I cancel a deal after accepting it?",
    a: "As a buyer, you can cancel the deal before confirming payment. Once you've confirmed payment, cancellation is no longer possible — you'll need to wait for the seller to confirm or raise a dispute after timeout.",
  },
  {
    q: "Is there a minimum or maximum trade amount?",
    a: "There is no platform-imposed minimum or maximum. Sellers set their own token amounts and prices when creating ads. You can trade as little as $1 worth of crypto.",
  },
  {
    q: "How long does a typical trade take?",
    a: "Most trades complete within 5–15 minutes. The deal timeout is set by the seller (typically 15–60 minutes) to give both parties enough time to complete the payment and confirmation.",
  },
  {
    q: "Which wallets are supported?",
    a: "Any wallet that supports BNB Smart Chain — MetaMask, Trust Wallet, Coinbase Wallet, and more. Just connect via the wallet button in the navbar.",
  },
  {
    q: "Do I need KYC to use Crypto P2P?",
    a: "No. Crypto P2P is fully decentralised and does not require any KYC, identity verification, or account creation. Just connect your wallet and start using the marketplace.",
  },
  {
    q: "What if I send payment to the wrong account?",
    a: "Always double-check the payment details shown in the deal before sending money. The platform displays the seller's exact payment information. If you send to the wrong account, the platform cannot reverse off-chain payments — raise a dispute and contact support on Telegram.",
  },
  {
    q: "Is my money safe on this platform?",
    a: "Your crypto is secured by an audited smart contract on BNB Smart Chain. The contract acts as a neutral escrow — it only releases tokens when conditions are met. Your INR payment goes directly to the seller (peer-to-peer), not through the platform.",
  },
  {
    q: "How do I contact support?",
    a: "You can reach our support team on Telegram at @Xplorertobi38. Use the support button in the bottom-right corner of the screen, or find the link in the footer and About page.",
  },
];

const FaqSection = () => (
  <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
    <ScrollReveal>
      <h2
        className="text-xl font-bold text-foreground mb-6 text-center sm:text-2xl"
        style={{ lineHeight: "1.15" }}
      >
        Frequently Asked Questions
      </h2>
    </ScrollReveal>
    <ScrollReveal delay={100}>
      <Accordion type="single" collapsible className="w-full">
        {FAQS.map((faq, i) => (
          <AccordionItem key={i} value={`faq-${i}`} className="border-border">
            <AccordionTrigger className="text-left text-sm text-foreground hover:no-underline hover:text-primary">
              {faq.q}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
              {faq.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </ScrollReveal>
  </section>
);

export default FaqSection;
