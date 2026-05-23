import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { defineChain } from "viem";
import { arcTestnet } from "./contracts";

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

export const wagmiConfig = getDefaultConfig({
  appName: "StableTrade Passport",
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "stabletrade-passport-demo",
  chains: [arcChain],
  transports: {
    [arcChain.id]: http(arcTestnet.rpcUrl)
  },
  ssr: false
});
