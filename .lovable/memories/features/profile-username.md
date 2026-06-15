---
name: Profile & Username system
description: Unique wallet-bound usernames shown across chat and UI; editable from /profile
type: feature
---
- Table `wallet_profiles` (wallet_address PK, username citext UNIQUE).
- Username validation: 3-20 chars, [A-Za-z0-9_], case-insensitive uniqueness via citext.
- `useWalletProfile(address)` — read/update own row (upsert with onConflict wallet_address).
- `useWalletProfiles(addresses[])` — cached batch loader; `displayName(addr)` returns `@username` or short address.
- Displayed in `MessageBubble`; Profile page at `/profile`.
- Wallet addresses are stored lowercased.
