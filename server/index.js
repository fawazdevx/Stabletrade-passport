const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");

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
