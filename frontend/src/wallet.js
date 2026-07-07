import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { defineChain } from "viem";
import { arcTestnet, gatewayChains } from "./contracts";

export const arcChain = defineChain({
  id: arcTestnet.chainId,
  name: arcTestnet.chainName,
  nativeCurrency: arcTestnet.nativeCurrency,
  rpcUrls: {
    default: {
      http: [arcTestnet.rpcUrl]
    }
  },
  testnet: true
});

export const gatewayWagmiChains = gatewayChains.map((chain) => defineChain({
  id: chain.chainId,
  name: chain.name,
  nativeCurrency: {
    name: chain.key === "arc" ? "USDC" : "Ether",
    symbol: chain.key === "arc" ? "USDC" : "ETH",
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: [chain.rpcUrl]
    }
  },
  blockExplorers: {
    default: {
      name: `${chain.name} Explorer`,
      url: chain.explorer
    }
  },
  testnet: true
}));

export const wagmiConfig = getDefaultConfig({
  appName: "StableTrade Passport",
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "stabletrade-passport-demo",
  chains: gatewayWagmiChains,
  transports: Object.fromEntries(gatewayChains.map((chain) => [chain.chainId, http(chain.rpcUrl)])),
  ssr: false
});
