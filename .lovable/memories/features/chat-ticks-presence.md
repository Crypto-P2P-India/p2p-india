---
name: WhatsApp-style chat ticks with presence
description: 1 grey check = sent, 2 grey = partner online (delivered), 2 blue = read
type: feature
---
- `useChatPresence(dealId, myAddress, partnerAddress)` uses Supabase presence channel `presence-deal-{id}-{ts}` keyed by lowercase wallet address.
- ChatPanel passes `partnerOnline` to MessageBubble; bubble shows: blue 2-ticks when `read_at`, grey 2-ticks when partner online, grey single tick otherwise.
- Online dot indicator rendered in chat header.
