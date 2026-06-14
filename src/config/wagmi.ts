import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  walletConnectWallet,
  okxWallet,
  trustWallet,
  coinbaseWallet,
  phantomWallet,
  injectedWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { bsc } from "wagmi/chains";
import { http } from "wagmi";

export const config = getDefaultConfig({
  appName: "Crypto P2P",
  projectId: "28e26a9fa8f1bef0d253abc623eec65c",
  chains: [bsc],
  transports: {
    [bsc.id]: http("https://bsc-dataseed.binance.org"),
  },
  ssr: false,
  wallets: [
    {
      groupName: "Popular",
      wallets: [metaMaskWallet, okxWallet, trustWallet, coinbaseWallet, walletConnectWallet],
    },
    {
      groupName: "More",
      wallets: [phantomWallet, injectedWallet],
    },
  ],
});

// Contract address — replace after deploying
export const P2P_CONTRACT_ADDRESS = "0x9Efd9b8EaC96dbe58141cE30785501bDFD196642" as const;

// BSC Mainnet USDT
export const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955" as const;

export const SUPPORTED_TOKENS = [
  { symbol: "BNB", address: null, decimals: 18, icon: "🔶" },
  { symbol: "USDT", address: USDT_ADDRESS, decimals: 18, icon: "💵" },
] as const;
