# StableTrade Passport Frontend

Modern React + Tailwind DApp interface for the StableTrade Passport demo.

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
VITE_WALLETCONNECT_PROJECT_ID=your_project_id
```

StableTrade is onchain-first. The backend is optional and only provides demo samples if it is running.

When a wallet is connected and an exporter wallet address is provided, invoice creation writes to the deployed `TradeEscrow` proxy on Arc testnet. Onchain invoices are loaded from the proxy by reading `nextInvoiceId()` and `invoices(id)`. The app also reads wallet USDC balance, proxy version, paused state, and next invoice ID directly from Arc.

Onchain actions:

- `createInvoice(exporter, amount, advanceAmount, metadataHash)`
- `approve(TradeEscrowProxy, amount)` on USDC before funding escrow
- `fundEscrow(invoiceId)`
- `approve(TradeEscrowProxy, advanceAmount)` on USDC before financier advance
- `payAdvance(invoiceId)`
- `releaseOnDelivery(invoiceId)`

If no wallet is connected, the app keeps using the backend demo flow so presentations still work without testnet funds.
If no wallet is connected, users can inspect deployed contracts and any existing Arc invoices, but cannot create or settle invoices.

## Document Uploads

The frontend lets users select an invoice and upload a document. It computes a SHA-256 hash in the browser and anchors that hash onchain.

If the backend has Pinata configured, the file is uploaded to IPFS first:

```bash
PINATA_JWT=your_pinata_jwt
PINATA_GATEWAY=https://your-gateway.mypinata.cloud
```

If Pinata is not configured, the DApp still anchors the local file hash so the demo remains functional.

## Platform Revenue

The V3 contract supports protocol fees on settlement. Configure `FEE_RECIPIENT` and `PROTOCOL_FEE_BPS` during the V3 upgrade. The frontend reads and displays the active fee recipient, fee rate, and accrued protocol fees.
