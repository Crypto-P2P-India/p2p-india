import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  walletConnectWallet,
  okxWallet,
  trustWallet,
  coinbaseWallet,
  phantomWallet,
  injectedWallet,
  bitgetWallet,
  binanceWallet,
  bybitWallet,
  rainbowWallet,
  safeWallet,
  ledgerWallet,
  tokenPocketWallet,
  imTokenWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { bsc } from "wagmi/chains";
import { http } from "wagmi";

const getWalletConnectUrl = () => {
  if (typeof window === "undefined") return "https://crypto-p2p.store";
  const { protocol, origin } = window.location;
  return protocol === "http:" || protocol === "https:" ? origin : "https://crypto-p2p.store";
};

export const config = getDefaultConfig({
  appName: "Crypto P2P",
  projectId: "5af4ffe8f14a00ebfc074c9d498eec14",
  walletConnectParameters: {
    metadata: {
      name: "Crypto P2P",
      description: "Crypto P2P",
      url: getWalletConnectUrl(),
      icons: ["https://crypto-p2p.store/favicon.png"],
      redirect: {
        native: "com.cryptop2p.chat://",
        universal: getWalletConnectUrl(),
      },
    },
  },
  chains: [bsc],
  transports: {
    [bsc.id]: http("https://bsc-dataseed.binance.org"),
  },
  ssr: false,
  wallets: [
    {
      groupName: "Popular",
      wallets: [
        injectedWallet,
        metaMaskWallet,
        okxWallet,
        bitgetWallet,
        binanceWallet,
        trustWallet,
        walletConnectWallet,
      ],
    },
    {
      groupName: "More",
      wallets: [
        bybitWallet,
        coinbaseWallet,
        rainbowWallet,
        tokenPocketWallet,
        imTokenWallet,
        phantomWallet,
        ledgerWallet,
        safeWallet,
      ],
    },
  ],
});

// Contract address — replace after deploying
export const P2P_CONTRACT_ADDRESS = "0x788ea5001811d7c5034e01c48177109e3f77aca0" as const;

// BSC Mainnet USDT
export const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955" as const;

export const SUPPORTED_TOKENS = [
  { symbol: "BNB", address: null, decimals: 18, icon: "🔶" },
  { symbol: "USDT", address: USDT_ADDRESS, decimals: 18, icon: "💵" },
] as const;
