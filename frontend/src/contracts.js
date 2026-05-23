export const arcTestnet = {
  chainId: Number(import.meta.env.VITE_ARC_CHAIN_ID || 5042002),
  chainName: import.meta.env.VITE_ARC_CHAIN_NAME || "Arc Testnet",
  rpcUrl: import.meta.env.VITE_ARC_RPC_URL || "https://rpc.testnet.arc.network",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 6
  }
};

export const deployedContracts = {
  tradeEscrowImplementation:
    import.meta.env.VITE_TRADE_ESCROW_IMPLEMENTATION || "0x6f62468D584406d177460Ad2353c7D2C19Ecf6bB",
  stableTradeFactory:
    import.meta.env.VITE_STABLE_TRADE_FACTORY || "0x2d34ff5B7418e8c1Fcf3EAEc1aeC16EDc7aa6586",
  tradeEscrowProxy:
    import.meta.env.VITE_TRADE_ESCROW_PROXY || "0xF167a3f1E362dBDC7d365A9Cb9340C8513e7188b",
  usdc: import.meta.env.VITE_USDC_ADDRESS || "0x3600000000000000000000000000000000000000",
  owner: import.meta.env.VITE_OWNER || "0xB3aae9496a6670d13e1b80B1Fb3ad445c635aC23"
};

export const tradeEscrowAbi = [
  {
    type: "function",
    name: "createInvoice",
    stateMutability: "nonpayable",
    inputs: [
      { name: "exporter", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "advanceAmount", type: "uint256" },
      { name: "metadataHash", type: "bytes32" }
    ],
    outputs: [{ name: "invoiceId", type: "uint256" }]
  },
  {
    type: "function",
    name: "fundEscrow",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "payAdvance",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "releaseOnDelivery",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "dispute",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "invoices",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "importer", type: "address" },
      { name: "exporter", type: "address" },
      { name: "financier", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "advanceAmount", type: "uint256" },
      { name: "status", type: "uint8" },
      { name: "metadataHash", type: "bytes32" }
    ]
  },
  {
    type: "function",
    name: "nextInvoiceId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  },
  {
    type: "function",
    name: "paused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "function",
    name: "settledVolume",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "usdc",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  },
  {
    type: "function",
    name: "version",
    stateMutability: "pure",
    inputs: [],
    outputs: [{ name: "", type: "string" }]
  },
  {
    type: "function",
    name: "submitFinanceBid",
    stateMutability: "nonpayable",
    inputs: [
      { name: "invoiceId", type: "uint256" },
      { name: "advanceAmount", type: "uint256" },
      { name: "feeBps", type: "uint256" }
    ],
    outputs: [{ name: "bidIndex", type: "uint256" }]
  },
  {
    type: "function",
    name: "acceptFinanceBid",
    stateMutability: "nonpayable",
    inputs: [
      { name: "invoiceId", type: "uint256" },
      { name: "bidIndex", type: "uint256" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "addTradeDocument",
    stateMutability: "nonpayable",
    inputs: [
      { name: "invoiceId", type: "uint256" },
      { name: "kind", type: "uint8" },
      { name: "documentHash", type: "bytes32" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "financeBidCount",
    stateMutability: "view",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "financeBid",
    stateMutability: "view",
    inputs: [
      { name: "invoiceId", type: "uint256" },
      { name: "bidIndex", type: "uint256" }
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "financier", type: "address" },
          { name: "advanceAmount", type: "uint256" },
          { name: "feeBps", type: "uint256" },
          { name: "accepted", type: "bool" },
          { name: "cancelled", type: "bool" }
        ]
      }
    ]
  },
  {
    type: "function",
    name: "tradeDocumentCount",
    stateMutability: "view",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "tradeDocument",
    stateMutability: "view",
    inputs: [
      { name: "invoiceId", type: "uint256" },
      { name: "documentIndex", type: "uint256" }
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "uploader", type: "address" },
          { name: "kind", type: "uint8" },
          { name: "documentHash", type: "bytes32" },
          { name: "timestamp", type: "uint256" }
        ]
      }
    ]
  },
  {
    type: "function",
    name: "passport",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [
      { name: "created", type: "uint256" },
      { name: "settled", type: "uint256" },
      { name: "disputed", type: "uint256" },
      { name: "volume", type: "uint256" },
      { name: "score", type: "uint256" }
    ]
  },
  {
    type: "function",
    name: "feeRecipient",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  },
  {
    type: "function",
    name: "protocolFeeBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "protocolFeesAccrued",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "event",
    name: "InvoiceCreated",
    inputs: [
      { indexed: true, name: "invoiceId", type: "uint256" },
      { indexed: true, name: "importer", type: "address" },
      { indexed: true, name: "exporter", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "metadataHash", type: "bytes32" }
    ]
  },
  {
    type: "event",
    name: "EscrowFunded",
    inputs: [
      { indexed: true, name: "invoiceId", type: "uint256" },
      { indexed: false, name: "amount", type: "uint256" }
    ]
  },
  {
    type: "event",
    name: "AdvancePaid",
    inputs: [
      { indexed: true, name: "invoiceId", type: "uint256" },
      { indexed: true, name: "financier", type: "address" },
      { indexed: false, name: "advanceAmount", type: "uint256" }
    ]
  },
  {
    type: "event",
    name: "InvoiceSettled",
    inputs: [
      { indexed: true, name: "invoiceId", type: "uint256" },
      { indexed: false, name: "exporterPayout", type: "uint256" },
      { indexed: false, name: "financierRepayment", type: "uint256" }
    ]
  }
];

export const usdcAbi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  }
];
