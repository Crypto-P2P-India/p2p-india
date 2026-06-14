# Align UI/UX with the New Contract Flow

The new contract (`0x788ea5…aca0`) introduces several flow changes that the current UI does not surface. This plan retrofits the app so every screen matches on-chain behavior 1:1.

## What's new in the contract

1. **Per-ad fee snapshot** — `sellerFeeBpsSnapshot` / `buyerFeeBpsSnapshot` stored on each ad (instead of global only).
2. **Configurable payWindow per ad** — seller chooses `PAY_WINDOW_15` (15m) or `PAY_WINDOW_30` (30m) at ad creation.
3. **Configurable adDuration** — between `MIN_AD_DURATION` and `MAX_AD_DURATION`, stored as `expiresAt`.
4. **Deal pay-deadline extensions:**
   - `buyerExtendPayWindow(dealId)` — buyer can self-extend once by `BUYER_SELF_EXTENSION`.
   - `sellerProposeExtension(dealId, extraSeconds)` — seller proposes `SELLER_EXTRA_15` or `SELLER_EXTRA_30`.
   - `buyerAcceptExtension(dealId)` — buyer accepts the proposal.
   - `sellerCancelExtensionProposal(dealId)` — seller withdraws.
5. **`sellerReclaimExpired(dealId)`** — seller reclaims funds after pay deadline passes without payment.
6. **`payDeadline(dealId)` view** — authoritative live deadline (handles extensions, paid state).
7. **`quoteCreateCost(amount)`** — returns `totalRequired` + `prepaidFee` for ad creation (used by `createSellAdNative` `msg.value`).
8. **New events** — `BuyerExtendedPayWindow`, `SellerProposedExtension`, `BuyerAcceptedExtension`, `SellerCancelledExtension`, `DealReleased` (with fee breakdown), `AdCancelled` (with refund + feeRefunded).
9. **Deal struct changes** — adds `payDeadlineOffset`, `buyerExtensionUsed`, `sellerProposedExtra`, `sellerExtensionUsed`, `disputeRaisedBy`.
10. **Ad struct changes** — adds `feeReserve`, `sellerFeeBpsSnapshot`, `buyerFeeBpsSnapshot`, `payWindow`, `expiresAt`, `createdAt`.

## UI/UX changes

### Ad creation (`CreateOrderModal`)
- Add **Pay Window** selector: `15 min` / `30 min`.
- Add **Ad Duration** selector: 30m / 1h / 6h / 24h / 72h (clamped to `MIN_AD_DURATION`–`MAX_AD_DURATION`).
- For BNB ads, call `quoteCreateCost(amount)` to compute exact `msg.value` (no manual fee math).
- For USDT ads, read `quoteCreateCost` to compute `totalRequired` allowance.
- Show a "Fee reserve: X (refunded on cancel)" hint.

### Ad listing / browse (`useContractAds`, `OrderCard`)
- Read `expiresAt` and show countdown / "Expires in".
- Read `payWindow` per ad and show "Pay window: 15m" badge.
- Read fee snapshots and show effective fees per ad.
- Hide ads where `expiresAt < now` even if `active=true`.

### My Ads
- New action **Reclaim expired deal** (calls `sellerReclaimExpired`) when a buyer's pay window passed.
- New action **Propose extension** (15m/30m) on a locked, unpaid deal.
- New action **Cancel extension proposal** when `sellerProposedExtra > 0`.
- Show pending proposal state ("Waiting for buyer to accept +15m").

### My Deals (buyer side, `TradeWindow`)
- Show live `payDeadline` (refetched), not a hardcoded `createdAt + 15m`.
- New action **Extend pay window** (one-time, +X min) when `!buyerExtensionUsed`.
- New action **Accept seller's extension** when `sellerProposedExtra > 0 && !sellerExtensionUsed`.
- Show banner "Seller offered +15m — Accept / Ignore".
- Disable Mark Paid after `payDeadline` (deal effectively expired).

### Hooks (`useContractDeals`, `useContractAds`)
- Map new struct fields (`payDeadlineOffset`, `buyerExtensionUsed`, `sellerProposedExtra`, `sellerExtensionUsed`, `disputeRaisedBy`).
- Compute deadline via `createdAt + payWindow + extensions` and prefer `payDeadline()` for UI.
- Use ad's `payWindow` (not the hardcoded 15-min constant).

### Deal Timeline (`useDealTxHashes`, `DealTimeline`)
- Add event renderers: `BuyerExtendedPayWindow` ("Buyer extended +Xm"), `SellerProposedExtension` ("Seller offered +Xm"), `BuyerAcceptedExtension` ("Buyer accepted +Xm"), `SellerCancelledExtension` ("Seller withdrew offer").
- Update `DealReleased` to show `sellerFee`/`buyerFee` breakdown.
- Update `AdCancelled` to show refunded amount + fee refund.

### Admin dashboard
- Surface new admin actions if not already wired: `adminCloseAd`, `adminReleaseToBuyer`, `adminRefundToSeller` (these existed; verify ABI bindings).
- Two-step ownership: show `pendingOwner` + `acceptOwnership` action.

### Misc
- Update `useBnbPrice` consumers: nothing changes, but show prepaid-fee BNB in the create-ad summary using `quoteCreateCost`.
- Update fee bps reads — display per-ad snapshot (from `getAd`) instead of always reading global `sellerFeeBps()` / `buyerFeeBps()`.
- Update copy: "Pay window" terminology should match contract names.

## Technical notes

- `useContractAds.ts` — extend `LiveAd` with `payWindow`, `expiresAt`, `sellerFeeBps`, `buyerFeeBps`, `feeReserve`; map from new struct order.
- `useContractDeals.ts` — extend `LiveDeal` with `buyerExtensionUsed`, `sellerProposedExtra`, `sellerExtensionUsed`, `payDeadlineOffset`, `disputeRaisedBy`; compute deadline from ad's `payWindow + payDeadlineOffset`.
- New hook `useDealPayDeadline(dealId)` calling `payDeadline()` with 5s refetch for the active trade screen.
- New hook `useQuoteCreateCost(amount)` for ad creation summary.
- `useDealTxHashes.ts` — add the four new extension events + adjust `DealReleased`/`AdCancelled` signatures.
- `TradeWindow.tsx` — new buttons + banners for extension flows.
- `MyAds.tsx` — new "Reclaim" + "Propose extension" controls per deal.
- `CreateOrderModal.tsx` — new selectors + `quoteCreateCost` call.

## Out of scope

- Smart-contract changes (contract is already deployed).
- Redesigning the visual theme (Binance-style dark theme stays).
- Adding new payment methods.

## Estimated touch list

- `src/hooks/useContractAds.ts`
- `src/hooks/useContractDeals.ts`
- `src/hooks/useDealTxHashes.ts`
- `src/hooks/useDealPayDeadline.ts` (new)
- `src/hooks/useQuoteCreateCost.ts` (new)
- `src/components/CreateOrderModal.tsx`
- `src/components/TradeWindow.tsx`
- `src/components/OrderCard.tsx`
- `src/components/DealTimeline.tsx`
- `src/pages/MyAds.tsx`
- `src/pages/MyOrders.tsx`
- `src/pages/Admin.tsx`

Proceed?
