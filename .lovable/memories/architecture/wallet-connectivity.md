---
name: Wallet Connectivity
description: Hybrid wallet connection — In-App Browser primary, WalletConnect fallback on native; RainbowKit on web
type: architecture
---
**Web (browser):** RainbowKit ConnectButton with full wallet list + WalletConnect.

**Native (Capacitor Android):** Custom `MobileWalletSheet` opens instead of RainbowKit modal.
- Primary path is direct phone-wallet connection through wagmi/RainbowKit connectors for MetaMask, OKX, Trust, and Coinbase.
- If `window.ethereum` is detected, shows "Connect Detected Wallet" using wagmi `injected` connector.
- The sheet auto-closes as soon as wagmi reports `isConnected`, avoiding the stale "Connect Wallet" modal after approval.
- "Other wallets" remains as a fallback button that opens the original RainbowKit modal via `useConnectModal()`.

**Why:** Raw WalletConnect v2 deep-linking from Android WebView can open the wallet but fail to update UI quickly. The app should try known wallet app connectors first and only use WalletConnect as fallback.

File: `src/components/MobileWalletSheet.tsx`. Mounted in `src/components/Navbar.tsx` (native only).
