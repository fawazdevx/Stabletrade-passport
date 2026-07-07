const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const GATEWAY_API_BASE_URL = process.env.GATEWAY_API_BASE_URL || "https://gateway-api-testnet.circle.com/v1";

// Illustrative sample balances returned only when the live Gateway API is
// unreachable. The frontend labels these "Sample balances" — never as live.
// Kept as round figures so they don't imitate real precise balances.
const gatewayDemoBalances = [
  { domain: 26, name: "Arc Testnet", balance: "15000.000000" },
  { domain: 6, name: "Base Sepolia", balance: "8000.000000" },
  { domain: 0, name: "Ethereum Sepolia", balance: "5000.000000" },
  { domain: 3, name: "Arbitrum Sepolia", balance: "4000.000000" }
];

const state = {
  invoices: [
    {
      id: "INV-2026-041",
      buyer: "Al Noor Retail LLC",
      seller: "Kigali Textiles Co.",
      corridor: "UAE -> Rwanda",
      amount: 18500,
      advanceRate: 0.82,
      dueDays: 28,
      status: "escrowed",
      walletStatus: "Circle Wallet ready",
      riskScore: 84,
      history: [
        "PO uploaded",
        "Importer escrow funded with testnet USDC",
        "Financier advance offer generated"
      ]
    },
    {
      id: "INV-2026-052",
      buyer: "Mina Foods FZCO",
      seller: "Accra Cold Chain",
      corridor: "UAE -> Ghana",
      amount: 9600,
      advanceRate: 0.76,
      dueDays: 16,
      status: "escrowed",
      walletStatus: "Embedded wallets provisioned",
      riskScore: 78,
      history: [
        "KYC attestation checked",
        "Milestone escrow created",
        "Delivery proof pending"
      ]
    }
  ],
  events: [
    {
      time: new Date().toISOString(),
      title: "Demo environment initialized",
      detail: "Arc testnet-style USDC settlement workflow is ready."
    }
  ]
};

const seededDemoInvoice = {
  id: "DEMO-UAE-NG-001",
  buyer: "Dubai Equipment Mart",
  seller: "Lagos Parts Cooperative",
  corridor: "UAE -> Nigeria",
  amount: 24800,
  advanceRate: 0.82,
  dueDays: 21,
  status: "advanced",
  walletStatus: "Circle Wallet ready",
  riskScore: 91,
  source: "demo",
  metadataHash: "0x9b5a5f3a7863b2df8ed493ed52c0f24a1a2fe3da58f2c3ad88cf71d4be2417f0",
  importerAddress: "0xB3aae9496a6670d13e1b80B1Fb3ad445c635aC23",
  sellerAddress: "0x6F4c2C98fD7b3FfE14F3Ddb0e782cE3f4c0d4581",
  financierAddress: "0x2B4B7361c65e9234f9cE9b73bDBE3E7464C5A621",
  financeFeeBps: 220,
  documents: [
    {
      kind: 0,
      hash: "0x5ee717721fd6b57e9e75c00a276f817d09302b865f9db94f28f019b8ba94760d",
      uploader: "0xB3aae9496a6670d13e1b80B1Fb3ad445c635aC23"
    },
    {
      kind: 1,
      hash: "0xa7ad46bc1dd212d5690c60d16ef2eb31f96a2e1edbc47f120ba6f7c59b2aa950",
      uploader: "0x6F4c2C98fD7b3FfE14F3Ddb0e782cE3f4c0d4581"
    },
    {
      kind: 2,
      hash: "0xe0526f65f2034dbfa13a9a30b98dd8e08ca1a65a0c56c67061e63f8b0a4df035",
      uploader: "0x6F4c2C98fD7b3FfE14F3Ddb0e782cE3f4c0d4581"
    }
  ],
  bids: [
    {
      index: 0,
      financier: "0x2B4B7361c65e9234f9cE9b73bDBE3E7464C5A621",
      advanceAmount: 20336,
      feeBps: 220,
      accepted: true,
      cancelled: false
    },
    {
      index: 1,
      financier: "0x5214bb08f6e79A8922f95c5f215F59d7945F12a7",
      advanceAmount: 19840,
      feeBps: 280,
      accepted: false,
      cancelled: false
    }
  ],
  history: [
    "Gateway route staged from Base Sepolia to Arc",
    "CCTP funding receipt generated",
    "Purchase order, invoice, and delivery proof anchored",
    "Financier bid accepted: 20,336 USDC advance at 2.2% fee"
  ],
  settlementWaterfall: {
    importerEscrow: 24800,
    exporterAdvance: 20336,
    financierFee: 447.39,
    financierRepayment: 20783.39,
    protocolFee: 20.08,
    exporterFinalPayout: 3996.53,
    exporterTotalReceived: 24332.53
  }
};

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function txHash(prefix) {
  return `0x${crypto.createHash("sha256").update(`${prefix}:${Date.now()}:${Math.random()}`).digest("hex")}`;
}

function addEvent(title, detail) {
  const event = { time: new Date().toISOString(), title, detail };
  state.events.unshift(event);
  state.events = state.events.slice(0, 12);
  return event;
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const safePath = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(PUBLIC, safePath === "/" ? "index.html" : safePath);
  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC, "index.html");
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": mime[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      app: "StableTrade Passport",
      chain: "Arc Testnet",
      settlementAsset: "USDC"
    });
    return;
  }

  if (url.pathname === "/api/invoices" && req.method === "GET") {
    sendJson(res, 200, { invoices: state.invoices, events: state.events });
    return;
  }

  if (url.pathname === "/api/demo/seed" && req.method === "POST") {
    const existingIndex = state.invoices.findIndex((invoice) => invoice.id === seededDemoInvoice.id);
    if (existingIndex >= 0) {
      state.invoices[existingIndex] = { ...seededDemoInvoice };
    } else {
      state.invoices.unshift({ ...seededDemoInvoice });
    }
    addEvent("Winning demo scenario seeded", "UAE importer, Lagos exporter, accepted financier bid, Gateway route, CCTP receipt, and delivery proofs are ready.");
    addEvent("Settlement waterfall ready", "Financier repayment includes principal plus fee before exporter final payout.");
    sendJson(res, 200, { invoice: seededDemoInvoice, events: state.events });
    return;
  }

  if (url.pathname === "/api/gateway/balances" && req.method === "POST") {
    const body = await readBody(req);
    const sources = Array.isArray(body.sources) ? body.sources : [];

    if (sources.length === 0) {
      sendJson(res, 400, { error: "sources are required" });
      return;
    }

    try {
      const gatewayRes = await fetch(`${GATEWAY_API_BASE_URL.replace(/\/$/, "")}/balances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "USDC", sources })
      });
      const gatewayBody = await gatewayRes.json().catch(() => ({}));
      if (!gatewayRes.ok) {
        throw new Error(gatewayBody.error || `Gateway balance request failed: ${gatewayRes.status}`);
      }
      sendJson(res, 200, { ...gatewayBody, source: "circle-gateway" });
    } catch (error) {
      sendJson(res, 200, {
        token: "USDC",
        source: "demo-fallback",
        warning: error.message,
        balances: sources.map((source, index) => {
          const match = gatewayDemoBalances.find((item) => item.domain === Number(source.domain));
          return {
            domain: Number(source.domain),
            depositor: source.depositor,
            balance: match ? match.balance : (2500 + index * 750).toFixed(6)
          };
        })
      });
    }
    return;
  }

  if (url.pathname === "/api/cctp/demo-receipt" && req.method === "POST") {
    const body = await readBody(req);
    const amount = Number(body.amount || 0);
    if (!body.sourceChain || !body.destinationChain || !amount) {
      sendJson(res, 400, { error: "sourceChain, destinationChain, and amount are required" });
      return;
    }

    const receipt = {
      id: `CCTP-${Date.now().toString(36).toUpperCase()}`,
      provider: "Circle App Kit / CCTP v2",
      state: "demo-ready",
      amount: amount.toFixed(2),
      token: "USDC",
      sourceChain: body.sourceChain,
      destinationChain: body.destinationChain,
      recipient: body.recipient || "connected wallet",
      forwardingService: Boolean(body.forwardingService),
      steps: [
        { name: "approve", state: "ready", hash: txHash("cctp:approve") },
        { name: "burn", state: "ready", hash: txHash("cctp:burn") },
        { name: "fetchAttestation", state: "ready", attestation: txHash("cctp:attestation") },
        { name: "mint", state: "ready", hash: txHash("cctp:mint") }
      ],
      createdAt: new Date().toISOString()
    };
    addEvent("CCTP route prepared", `${receipt.amount} USDC from ${receipt.sourceChain} to ${receipt.destinationChain}.`);
    sendJson(res, 200, { receipt });
    return;
  }

  if (url.pathname === "/api/invoices" && req.method === "POST") {
    const body = await readBody(req);
    const amount = Number(body.amount || 0);
    if (!body.buyer || !body.seller || !amount) {
      sendJson(res, 400, { error: "buyer, seller, and amount are required" });
      return;
    }
    const invoice = {
      id: `INV-${new Date().getFullYear()}-${String(state.invoices.length + 61).padStart(3, "0")}`,
      buyer: body.buyer,
      seller: body.seller,
      corridor: body.corridor || "UAE -> Global",
      amount,
      advanceRate: Math.min(0.9, Math.max(0.55, Number(body.advanceRate || 0.78))),
      dueDays: Number(body.dueDays || 30),
      status: "draft",
      walletStatus: "Needs Circle Wallet provisioning",
      riskScore: Math.round(62 + Math.min(28, amount / 1000)),
      history: ["Invoice created", "Awaiting importer escrow"]
    };
    state.invoices.unshift(invoice);
    addEvent("Invoice created", `${invoice.id} for ${invoice.amount.toLocaleString()} USDC`);
    sendJson(res, 201, { invoice });
    return;
  }

  if (url.pathname === "/api/ipfs/upload" && req.method === "POST") {
    const body = await readBody(req);
    if (!body.fileName || !body.base64) {
      sendJson(res, 400, { error: "fileName and base64 are required" });
      return;
    }

    const buffer = Buffer.from(body.base64, "base64");
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");

    if (!process.env.PINATA_JWT) {
      sendJson(res, 200, {
        uploaded: false,
        documentHash: `0x${hash}`,
        message: "PINATA_JWT is not configured; returned local content hash only."
      });
      return;
    }

    const form = new FormData();
    form.append("file", new Blob([buffer], { type: body.mimeType || "application/octet-stream" }), body.fileName);
    form.append("pinataMetadata", JSON.stringify({ name: body.fileName }));

    const pinataRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PINATA_JWT}`
      },
      body: form
    });
    const pinataBody = await pinataRes.json();
    if (!pinataRes.ok) {
      sendJson(res, 502, { error: pinataBody.error || "Pinata upload failed", documentHash: `0x${hash}` });
      return;
    }

    sendJson(res, 200, {
      uploaded: true,
      cid: pinataBody.IpfsHash,
      uri: `ipfs://${pinataBody.IpfsHash}`,
      gatewayUrl: process.env.PINATA_GATEWAY
        ? `${process.env.PINATA_GATEWAY.replace(/\/$/, "")}/ipfs/${pinataBody.IpfsHash}`
        : undefined,
      documentHash: `0x${hash}`
    });
    return;
  }

  if (url.pathname.startsWith("/api/invoices/") && req.method === "POST") {
    const [, , , id, action] = url.pathname.split("/");
    const invoice = state.invoices.find((item) => item.id === id);
    if (!invoice) {
      sendJson(res, 404, { error: "invoice not found" });
      return;
    }
    const hash = txHash(`${id}:${action}`);
    if (action === "fund-escrow") {
      invoice.status = "escrowed";
      invoice.walletStatus = "Circle Wallet ready";
      invoice.history.unshift(`Escrow funded: ${hash.slice(0, 14)}...`);
      addEvent("USDC escrow funded", `${invoice.id} locked buyer funds on Arc testnet.`);
    } else if (action === "approve-advance") {
      invoice.status = "advanced";
      const advance = Math.round(invoice.amount * invoice.advanceRate);
      invoice.history.unshift(`Financier advanced ${advance.toLocaleString()} USDC`);
      addEvent("Receivable financed", `${invoice.seller} received working capital for ${invoice.id}.`);
    } else if (action === "release") {
      invoice.status = "settled";
      invoice.history.unshift(`Milestone released: ${hash.slice(0, 14)}...`);
      addEvent("Escrow settled", `${invoice.id} released by proof-of-delivery trigger.`);
    } else {
      sendJson(res, 404, { error: "unknown invoice action" });
      return;
    }
    sendJson(res, 200, { invoice, simulatedArcTx: hash });
    return;
  }

  serveStatic(req, res);
}

const server = http.createServer((req, res) => {
  route(req, res).catch((error) => {
    sendJson(res, 500, { error: error.message });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`StableTrade Passport running at http://${HOST}:${PORT}`);
});
