# StableTrade Passport

StableTrade Passport is a hackathon MVP for the Stablecoin Commerce Stack Challenge, submitted for Track 2: Best SME Trade Finance & Working Capital Workflow.

It demonstrates UAE importer escrow, global exporter working-capital advances, proof-of-delivery settlement, and an SME credit passport built from verifiable USDC payment history.

## Why This Track

Track 2 is the strongest path because it combines visible regional value with technical depth:

- UAE trade corridors involve real SME pain around payment delays, trust, and working capital.
- Arc's predictable USDC fees and deterministic settlement are directly relevant to escrow and repayment waterfalls.
- The product can show a working app, backend workflow, and smart contract logic without depending on gated Circle products.
- It still leaves room to mention future USYC treasury yield for idle escrow balances if enterprise access is granted.

## Circle Products Used on Arc

- USDC: settlement asset for importer escrow, exporter advance, and financier repayment.
- Circle Wallets: embedded wallets for importers, exporters, and financiers.
- Circle Gateway: treasury movement and multi-party payout orchestration.
- CCTP with Bridge Kit: optional cross-chain USDC movement into Arc when funds originate from another supported chain.

## Demo Features

- Create invoice and corridor records.
- Fund stablecoin escrow.
- Advance exporter working capital.
- Release funds on delivery.
- Show live audit events and credit-passport metrics.
- Include a Foundry-ready Solidity escrow contract for Arc testnet deployment.
- Include architecture diagram for submission materials.

## Run Locally

Backend API and legacy static UI:

```bash
npm run dev
```

Open `http://localhost:4173`.

If that port is already in use, run another port:

```bash
PORT=4174 npm run dev
```

Modern React + Tailwind DApp:

```bash
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. The frontend proxies `/api` to `http://127.0.0.1:4174` by default.

## Smart Contract

The contract in `contracts/src/TradeEscrow.sol` models the Arc onchain workflow:

1. Importer creates an invoice.
2. Importer funds escrow in USDC.
3. Financier optionally pays an advance to the exporter.
4. Importer releases escrow after delivery.
5. Contract updates participant settlement history for the SME credit passport.

For hackathon demo purposes, the frontend uses a Node API to simulate Circle developer tools and Arc transaction hashes. A production version would connect the API to Circle Wallets, Gateway, Bridge Kit, and deployed Arc testnet contract calls.

## Arc Testnet Deployment

Upgradeable stack:

- TradeEscrow implementation: `0x6f62468D584406d177460Ad2353c7D2C19Ecf6bB`
- StableTradeFactory: `0x2d34ff5B7418e8c1Fcf3EAEc1aeC16EDc7aa6586`
- TradeEscrow proxy: `0xF167a3f1E362dBDC7d365A9Cb9340C8513e7188b`
- USDC: `0x3600000000000000000000000000000000000000`
- Owner: `0xB3aae9496a6670d13e1b80B1Fb3ad445c635aC23`
- Chain ID: `5042002`
- RPC: `https://rpc.testnet.arc.network`

The DApp should use the proxy address as the stable contract address.

## Architecture

Open `http://localhost:4173/architecture.html` for the diagram.

## Circle Product Feedback

### Why These Products

USDC is the natural settlement rail for trade escrow because each party can reason in dollar-denominated amounts. Circle Wallets reduce onboarding friction for SMEs that are not crypto-native. Gateway fits treasury and payout routing, while CCTP with Bridge Kit covers cases where an importer or financier already holds USDC on another network.

### What Worked Well

The product boundaries are clear: Wallets for account/key UX, USDC for settlement, Gateway for operational routing, and CCTP for cross-chain movement. This makes it easy to explain which Circle component handles each part of the trade-finance workflow.

### What Could Be Improved

Hackathon teams benefit from complete sandbox examples that combine embedded wallets, CCTP, Gateway-style routing, and a sample EVM contract in one flow. The biggest lift is stitching docs across product surfaces into a single end-to-end testnet journey.

### Recommendations

Provide a reference "invoice escrow on Arc" sample app with mocked compliance attestations, testnet USDC funding steps, and deploy scripts. Add a small-business oriented dashboard example showing how transaction history can become a credit-passport data model.
