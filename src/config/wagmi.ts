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
import type { Wallet } from "@rainbow-me/rainbowkit";
import { bsc } from "wagmi/chains";
import { http } from "wagmi";

const okxWalletWithNativeDeepLink = (options: Parameters<typeof okxWallet>[0]): Wallet => {
  const wallet = okxWallet(options);
  return {
    ...wallet,
    mobile: {
      ...wallet.mobile,
      getUri: (uri: string) => `okex://main/wc?uri=${encodeURIComponent(uri)}`,
    },
  };
};

export const config = getDefaultConfig({
  appName: "Crypto P2P",
  projectId: "5af4ffe8f14a00ebfc074c9d498eec14",
  walletConnectParameters: {
    metadata: {
      name: "Crypto P2P",
      description: "Crypto P2P",
      url: "https://crypto-p2p.store",
      icons: ["https://crypto-p2p.store/favicon.png"],
      redirect: {
        native: "com.cryptop2p.chat://",
        universal: "https://crypto-p2p.store",
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
      wallets: [metaMaskWallet, okxWalletWithNativeDeepLink, trustWallet, coinbaseWallet, walletConnectWallet],
    },
    {
      groupName: "More",
      wallets: [phantomWallet, injectedWallet],
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
