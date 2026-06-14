---
name: Wallet Connectivity
description: QR-first WalletConnect native flow; RainbowKit on web
type: architecture
---
**Web (browser):** RainbowKit ConnectButton with full wallet list + WalletConnect.

**Native (Capacitor Android):** Custom `MobileWalletSheet` opens instead of RainbowKit modal.
- Primary path is QR-first WalletConnect: show a QR inside the app, user scans from wallet, then transactions can be pushed through wagmi after approval.
- If `window.ethereum` is detected, shows "Connect Detected Wallet" using wagmi `injected` connector.
- Direct phone-wallet buttons for MetaMask, OKX, Trust, and Coinbase remain as fallback options.
- The sheet auto-closes as soon as wagmi reports `isConnected`, avoiding the stale "Connect Wallet" modal after approval.
- "Other wallets" remains as a fallback button that opens the original RainbowKit modal via `useConnectModal()`.

**Why:** Android WebView deep-links can open the wallet without showing approval. QR WalletConnect avoids the broken handoff and is the native primary path.

File: `src/components/MobileWalletSheet.tsx`. Mounted in `src/components/Navbar.tsx` (native only).
