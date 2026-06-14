---
name: Wallet Connectivity
description: Hybrid wallet connection — In-App Browser primary, WalletConnect fallback on native; RainbowKit on web
type: architecture
---
**Web (browser):** RainbowKit ConnectButton with full wallet list + WalletConnect.

**Native (Capacitor Android):** Custom `MobileWalletSheet` opens instead of RainbowKit modal.
- If `window.ethereum` is detected (user opened the app inside a wallet's in-app browser), shows "Connect Detected Wallet" using wagmi `injected` connector — instant, reliable.
- Otherwise shows deep-link buttons for MetaMask, Trust, OKX, Bitget, Coinbase that open each wallet's in-app DApp browser at `https://crypto-p2p.store` (e.g. `https://metamask.app.link/dapp/crypto-p2p.store`, `okx://wallet/dapp/url?dappUrl=...`).
- WalletConnect QR remains as a fallback button that opens the original RainbowKit modal via `useConnectModal()`.

**Why:** Raw WalletConnect v2 deep-linking from Android WebView often opens the wallet but the connection proposal never arrives (relay handshake stalls). Routing users through the wallet's own in-app browser avoids the WC handshake entirely.

File: `src/components/MobileWalletSheet.tsx`. Mounted in `src/components/Navbar.tsx` (native only).
