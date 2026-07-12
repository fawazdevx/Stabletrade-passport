const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Readable, Writable } = require("node:stream");
const { finished } = require("node:stream/promises");
const test = require("node:test");

const { createRequestHandler } = require("./index.js");

const ROOT = path.join(__dirname, "..");

class MockResponse extends Writable {
  constructor() {
    super();
    this.statusCode = 200;
    this.headers = {};
    this.chunks = [];
  }

  writeHead(statusCode, headers = {}) {
    this.statusCode = statusCode;
    this.headers = headers;
  }

  _write(chunk, _encoding, callback) {
    this.chunks.push(Buffer.from(chunk));
    callback();
  }

  body() {
    return Buffer.concat(this.chunks).toString("utf8");
  }

  json() {
    return JSON.parse(this.body());
  }
}

async function request(handler, method, url, body) {
  const payload = body ? JSON.stringify(body) : "";
  const req = Readable.from(payload ? [payload] : []);
  req.method = method;
  req.url = url;
  req.headers = { host: "stabletrade.test", "content-type": "application/json" };

  const res = new MockResponse();
  await handler(req, res);
  await finished(res);
  return res;
}

test("public server serves React build when frontend/dist exists", async () => {
  const distIndex = path.join(ROOT, "frontend", "dist", "index.html");
  assert.equal(fs.existsSync(distIndex), true, "frontend/dist/index.html must exist before this public serving check");

  const handler = createRequestHandler({ env: {} });
  const res = await request(handler, "GET", "/");
  const body = res.body();

  assert.equal(res.statusCode, 200);
  assert.match(body, /<div id="root"><\/div>/);
  assert.match(body, /\/assets\/index-/);
});

test("unsafe demo mutation and upload endpoints are disabled by default", async () => {
  const handler = createRequestHandler({ env: {} });
  const requests = [
    request(handler, "POST", "/api/demo/seed"),
    request(handler, "POST", "/api/invoices", { buyer: "A", seller: "B", amount: 100 }),
    request(handler, "POST", "/api/cctp/demo-receipt", { sourceChain: "Base Sepolia", destinationChain: "Arc Testnet", amount: 1 }),
    request(handler, "POST", "/api/ipfs/upload", { fileName: "invoice.txt", base64: Buffer.from("test").toString("base64") })
  ];

  const responses = await Promise.all(requests);
  assert.deepEqual(responses.map((res) => res.statusCode), [403, 403, 403, 403]);
});

test("Gateway balance endpoint reports live failure instead of sample balances by default", async () => {
  const handler = createRequestHandler({ env: { GATEWAY_API_BASE_URL: "http://127.0.0.1:9/v1" } });
  const res = await request(handler, "POST", "/api/gateway/balances", {
    sources: [{ domain: 26, depositor: "0xB3aae9496a6670d13e1b80B1Fb3ad445c635aC23" }]
  });
  const body = res.json();

  assert.equal(res.statusCode, 502);
  assert.equal(body.source, "circle-gateway");
  assert.equal(body.live, false);
});
