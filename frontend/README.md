# StableTrade Passport Frontend

Modern React + Tailwind DApp interface for StableTrade Passport.

## Run

Start the backend first from the project root:

```bash
PORT=4174 npm run dev
```

Then run the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

The Vite dev server proxies `/api` to `http://127.0.0.1:4174`.

## Deployed Contracts

Copy `.env.example` to `.env.local` if you need to override addresses:

```bash
cp .env.example .env.local
```

Default Arc testnet values:

- TradeEscrow proxy: `0xF167a3f1E362dBDC7d365A9Cb9340C8513e7188b`
- StableTradeFactory: `0x2d34ff5B7418e8c1Fcf3EAEc1aeC16EDc7aa6586`
- TradeEscrow implementation: `0x6f62468D584406d177460Ad2353c7D2C19Ecf6bB`
- USDC: `0x3600000000000000000000000000000000000000`
- Chain ID: `5042002`

## Wallet + Onchain Flow

The app uses RainbowKit, wagmi, viem, and React Query.

Add a WalletConnect project ID for production demos:

```bash
VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

StableTrade is onchain-first. The backend provides read-only sample invoices, the Gateway balance proxy, and gated local helpers when it is running.

When a wallet is connected and an exporter wallet address is provided, invoice creation writes to the deployed `TradeEscrow` proxy on Arc testnet. Onchain invoices are loaded from the proxy by reading `nextInvoiceId()` and `invoices(id)`. The app also reads wallet USDC balance, proxy version, paused state, and next invoice ID directly from Arc.

Onchain actions:

- `createInvoice(exporter, amount, advanceAmount, metadataHash)`
- `approve(TradeEscrowProxy, amount)` on USDC before funding escrow
- `fundEscrow(invoiceId)`
- `approve(TradeEscrowProxy, advanceAmount)` on USDC before financier advance
- `payAdvance(invoiceId)`
- `addTradeDocument(invoiceId, DeliveryProof, documentHash)`
- `releaseOnDelivery(invoiceId)` after delivery proof exists

When a marketplace bid is accepted, the contract stores the accepted fee bps. Delivery settlement repays the financier principal plus that accepted fee first, then pays protocol fees and the exporter remainder. The invoice cards visualize the same waterfall so judges can see the trade-finance economics without reading contract code.

If no wallet is connected, users can inspect deployed contracts and any existing Arc invoices, but cannot create or settle invoices.

## Gateway Treasury

The Treasury tab shows Circle Gateway-style unified USDC balances across configured testnet domains:

- Arc Testnet: domain `26`
- Base Sepolia: domain `6`
- Ethereum Sepolia: domain `0`
- Arbitrum Sepolia: domain `3`

The frontend calls `/api/gateway/balances`; the backend proxies Circle Gateway's testnet `/balances` endpoint. Public mode returns a `502` if the live Gateway request fails instead of showing sample balances. Local sample balances require `ENABLE_GATEWAY_SAMPLE_FALLBACK=true`.

The Arc deposit action performs:

1. `approve(GatewayWallet, amount)` on Arc USDC.
2. `GatewayWallet.deposit(USDC, amount)`.

## CCTP Funding

The CCTP Funding tab uses Circle App Kit and `@circle-fin/adapter-viem-v2` with the connected browser wallet. It models Bridge Kit/App Kit routing from source testnets into Arc with the CCTP stages:

1. Approve
2. Burn
3. Fetch attestation
4. Mint

The live transfer path is limited to `<= 100 USDC` in the UI. If a wallet, source liquidity, or testnet route prevents completion, a labeled local receipt can be generated only when the backend has `ENABLE_DEMO_FALLBACKS=true` or a valid `ADMIN_TOKEN`.

## Risk-Based Marketplace

The Marketplace tab scores escrowed and advanced invoices using:

- Escrow/settlement status
- Document hash count
- Advance ratio
- Invoice size
- Existing bid signal
- Passport context

Each underwriting card shows a risk score, max advance percentage, suggested advance, fee bps, expected APR, and proof checks. The "Prefill bid" action fills the onchain bid form but does not submit any transaction.

## Agentic Finance Assistant

The Assistant tab watches invoice state, Gateway liquidity, CCTP readiness, and passport metrics. It recommends actions such as:

- Prefilling a financier bid for the best receivable
- Routing Gateway liquidity toward Arc settlement inventory
- Opening the passport export when the score supports better pricing

The assistant is intentionally prepare-only. Wallet signing, token approval, bid submission, bridge transfer, and settlement release remain manual user actions.

## Judge Walkthrough

Use these pages for the recording:

1. **System**: confirm Arc chain ID, proxy, version, pause state, fee settings, and wallet status.
2. **Trades**: create an invoice, fund escrow, accept financing, anchor delivery proof, and release settlement.
3. **Treasury**: show the live Gateway API status and, if funded, Arc Gateway inventory.
4. **CCTP Funding**: run the live route or show the gated receipt as a clearly labeled fallback.
5. **Marketplace**: underwrite the receivable, show suggested advance and fee bps, then submit or prefill a bid.
6. **Assistant**: apply a prepare-only recommendation.
7. **Passport**: export the credit passport JSON and QR verifier.

## Document Uploads

The frontend lets users select an invoice and upload a document. It computes a SHA-256 hash in the browser and anchors that hash onchain.

If the backend has Pinata configured, the file is uploaded to IPFS first:

```bash
PINATA_JWT=your_pinata_jwt
PINATA_GATEWAY=https://your-gateway.mypinata.cloud
```

Public mode disables backend uploads. Set `ENABLE_IPFS_UPLOADS=true` or provide `ADMIN_TOKEN` for a controlled local recording. If Pinata is not configured, the DApp can still anchor the local file hash onchain.

## Platform Revenue

The V3 contract supports protocol fees on settlement. Configure `FEE_RECIPIENT` and `PROTOCOL_FEE_BPS` during the V3 upgrade. The frontend reads and displays the active fee recipient, fee rate, and accrued protocol fees.

## Passport Export

The Passport tab exports a JSON credential containing:

- Holder wallet
- Arc chain ID and deployed proxy
- Passport metrics from `passport(address)`
- Related trade IDs, statuses, metadata hashes, and document hashes
- Gateway domains used by the project
- QR verifier URL for sharing with financiers or buyers
