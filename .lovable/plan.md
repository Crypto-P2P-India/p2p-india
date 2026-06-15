# Buyer Ads — Plan

Mirror of the existing Sell flow, with roles inverted. Buyer creates an ad asking for USDT in exchange for INR. Sellers (who hold USDT) accept partial/full chunks by locking their USDT in the contract.

## Phase 1 — Smart Contract (`contracts/BuyEscrowV1.sol`)

I will write the contract and hand you the source + ABI for you to deploy on BNB Smart Chain. You then paste the deployed address back and I'll wire it up.

### Roles
- **Buyer (ad creator)** — wants USDT, pays INR.
- **Seller (deal taker)** — has USDT, receives INR, locks USDT into the ad.
- **Admin (owner)** — dispute resolver, fee withdrawer, fee setter.

### Ad rules
- Asset: BEP-20 USDT only (v1).
- Amount range: min $1, max $50,000 per ad.
- Ad duration: min 1 day, max 7 days. Auto-hide after expiry.
- Payment window per deal: min 15m, max 30m (buyer chosen at ad creation).
- Min trade per deal (buyer-set) within ad bounds.
- Buyer rate (INR per USDT) stored on-chain.
- Payment methods: UPI / Bank Transfer / Digital Rupee — buyer stores name, payment method, UPI ID / bank details / QR ref on-chain at ad creation (so any taker sees them only after locking).
- Max 3 active ads per buyer.

### Deal rules (partial fills)
- Seller picks an amount between minTrade and remaining.
- On accept: seller transfers `amount + 0.1% sellerFee` USDT → contract. Funds are bucketed to *this ad* (`ad.lockedTotal`) and cannot be reused for other ads.
- Same seller cannot have 2 concurrent open deals with the same buyer (must finish first).
- Seller cap: max 3 concurrent open deals across all buyers.
- Payment timer starts on accept (uses ad's payment window).
- Buyer must click **Mark as Paid** before timer ends → locks the USDT (seller can no longer cancel).
- If buyer does NOT mark paid before timer ends → seller can `reclaim()` their locked USDT (minus nothing — sellerFee also returned on cancel per spec: "100% of locked fund back").
- Seller has 15 minutes after `markPaid` to `release()` USDT to buyer. Buyer receives `amount - 0.15% buyerFee`. Seller's 0.1% fee stays in contract.
- Buyer can extend payment window by +15m or +30m (requires seller approval).
- Seller can grant +5m one-shot unilaterally.
- After 15m post-markPaid with no release → either party can `openDispute()`.
- Admin resolves: `adminReleaseToBuyer()` or `adminReleaseToSeller()`. Seller can still release voluntarily at any time during dispute.

### Fees
- `buyerFeeBps = 15` (0.15%), `sellerFeeBps = 10` (0.1%), both `setFees()` by owner, capped at 100 bps each.
- Collected fees withdrawable by owner via `withdrawFees()`.
- Owner transferable via `transferOwnership()`.

### Storage layout (high level)
```text
struct Ad { buyer, totalAmount, remaining, lockedTotal, minTrade,
            rateInrPerUsdt, paymentWindow, expiresAt, status,
            paymentMethod, name, upiOrBank, qrRef }
struct Deal { adId, seller, amount, sellerFeeLocked, acceptedAt,
              paymentDeadline, markedPaidAt, status, disputeOpened }
mapping(uint=>Ad) ads;  mapping(uint=>Deal) deals;
mapping(address=>uint[]) buyerAds; mapping(address=>uint[]) sellerDeals;
mapping(address=>mapping(address=>uint)) openDealsBetween; // seller→buyer→count
```

### Key functions
`createAd`, `cancelAd`, `acceptDeal`, `markPaid`, `release`, `reclaimExpired`, `requestExtension`, `approveExtension`, `sellerGrantBonus`, `openDispute`, `adminReleaseToBuyer`, `adminReleaseToSeller`, `setFees`, `withdrawFees`, `transferOwnership`, plus views: `getAd`, `getDeal`, `getActiveAds`, `getBuyerAds`, `getSellerDeals`.

## Phase 2 — Frontend (after you give me deployed address + ABI)

- New marketplace section: **Buy Ads** tab alongside existing Sell Ads.
- `CreateBuyAdModal` — amount, min trade, rate, ad duration, payment window, payment method fields (auto-fill from `wallet_payment_profiles`).
- Buyer-ad card with **Accept** button → opens lock modal asking seller for partial amount + USDT approval + lock tx.
- `BuyDealWindow` (mirror of TradeWindow) showing buyer payment details, Mark Paid (buyer side) / Release (seller side) / Reclaim / Dispute / Extension flows.
- Reuse `deal_messages` table for chat (add `deal_kind = 'buy'` discriminator client-side via deal id namespace, e.g., negative ids or new column).
- Update My Ads page: tab for "Sell Ads" vs "Buy Ads". Update My Deals page similarly for sellers taking buy-ad deals.
- Marketplace sorting/filtering reused; "self-listing exclusion" rule applied.
- Admin dashboard: add Buy-ad dispute panel mirroring sell-ad one.

## Phase 3 — DB

Add `deal_kind` text column to `deal_messages` (default `'sell'`) so chats route correctly. No other schema changes; ad/deal state lives on-chain.

## Deliverable order

1. I write `contracts/BuyEscrowV1.sol` + matching ABI/artifact stub in `public/contracts/`.
2. You deploy on BSC mainnet, paste back the contract address.
3. I add the `deal_kind` migration, build all UI (buyer ad create, marketplace tab, accept/lock, deal window, chat, my-ads tab, admin panel).

## Open questions before I write the contract

1. **QR for buyer payment** — store the QR image URL on-chain (IPFS/Supabase URL string) or only payment method + UPI/bank and let seller scan from UPI app? On-chain string is cheaper if it's just a URL.
2. **Rate units** — store `rateInrPerUsdt` as integer with 2 decimals (e.g., `8550` = ₹85.50)? Confirms with existing sell contract precision.
3. **Extension approvals** — confirm both directions: buyer-requested extension needs seller approval; seller-granted +5m is unilateral, one-time per deal. OK?
