import { createContext, useContext } from "react";

// Central bag of state + handlers produced by the App component in main.jsx.
// Presentational workspace/layout files read from this instead of receiving
// 40+ individual props. All Circle/wagmi/viem logic still lives in App; this
// only carries references to it.
export const AppStateContext = createContext(null);

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) {
    throw new Error("useAppState must be used within <AppStateContext.Provider>");
  }
  return value;
}

// Persona model: the three trade-corridor roles. `roleKey` maps to the legacy
// activeRole values already used by the onchain filters (buyer/seller/financier).
export const personas = [
  {
    key: "importer",
    roleKey: "buyer",
    label: "Importer Dashboard",
    short: "Importer",
    entity: "Dubai Import Corp",
    blurb: "Funds escrow in USDC and releases on proof-of-delivery.",
    action: "fund-escrow"
  },
  {
    key: "financier",
    roleKey: "financier",
    label: "Financier Marketplace",
    short: "Financier",
    entity: "GCC Liquidity Partners",
    blurb: "Underwrites receivables and advances working capital.",
    action: "approve-advance"
  },
  {
    key: "exporter",
    roleKey: "seller",
    label: "Exporter Portal",
    short: "Exporter",
    entity: "Lagos Agri-Export Ltd",
    blurb: "Accepts advances and receives final settlement.",
    action: "accept-bid"
  }
];

export function personaByKey(key) {
  return personas.find((persona) => persona.key === key) || personas[0];
}
