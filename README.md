# StableTrade Passport

StableTrade Passport is a hackathon MVP for the Stablecoin Commerce Stack Challenge, submitted for Track 2: Best SME Trade Finance & Working Capital Workflow.

It demonstrates UAE importer escrow, global exporter working-capital advances, proof-of-delivery settlement, and an SME credit passport built from verifiable USDC payment history.

## Track Thesis

I picked Track 2: SME Trade Finance & Working Capital as the strongest path for this hackathon. StableTrade Passport focuses on a practical trade corridor workflow:

1. A UAE importer creates an invoice and funds escrow in USDC.
2. A global exporter receives invoice financing before final delivery.
3. Delivery proof unlocks USDC settlement and financier repayment.
4. Each completed trade improves a reusable SME credit passport for future buyers and lenders.

This makes Circle and Arc infrastructure visible in a real commerce workflow: USDC settlement, predictable Arc execution, CCTP/Gateway liquidity movement, and programmable proofs that can reduce working-capital friction for SMEs.

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
- Operate a Gateway treasury console with unified USDC balances across Arc, Base Sepolia, Ethereum Sepolia, and Arbitrum Sepolia.
- Run a CCTP funding workflow with Circle App Kit and Bridge Kit semantics: approve, burn, attestation, and mint into Arc.
- Export a verifiable SME credit passport as JSON with a QR verifier link, contract proofs, related trades, and document hashes.
- Underwrite invoices with risk-based financing recommendations, max advance limits, fee bps, expected APR, and proof checks.
- Repay financiers with principal plus accepted bid fee, then show the exporter/protocol payout waterfall.
- Seed a complete winning demo scenario with Gateway route, CCTP receipt, accepted financier bid, document proofs, and settlement waterfall.
- Use an agentic finance assistant that watches invoices, Gateway liquidity, CCTP state, and passport score to recommend the next best action.
- Walk judges through a dedicated demo operator script covering trade creation, treasury routing, CCTP funding, underwriting, agent actions, and passport export.
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

### Gateway, CCTP, and Passport Demo Path

The modern DApp now includes three additional hackathon-facing workspaces:

1. **Treasury**: queries Circle Gateway balances through `/api/gateway/balances`, shows unified USDC liquidity by Gateway domain, deposits Arc USDC into the testnet Gateway Wallet, and stages invoice liquidity routes.
2. **CCTP Funding**: uses Circle App Kit with the viem provider adapter to move testnet USDC from Base Sepolia, Ethereum Sepolia, or Arbitrum Sepolia into Arc. If a live wallet transfer cannot complete during a presentation, the backend returns a demo receipt with the same CCTP stages.
3. **Passport**: exports the onchain passport as a verifiable JSON credential with QR verifier URL, Arc contract address, score inputs, related trades, and document hashes.
4. **Marketplace**: ranks invoice receivables by risk score, proof coverage, recommended advance, fee bps, expected APR, and bid readiness.
5. **Assistant**: prepares bid and treasury actions from live app state while preserving manual wallet approval.
6. **Demo**: provides the operator script, one-click winning scenario seed, and architecture proof points for a concise video walkthrough.

Gateway balance queries use the public testnet Gateway endpoint by default:

```bash
GATEWAY_API_BASE_URL=https://gateway-api-testnet.circle.com/v1
```

The frontend includes default testnet Gateway addresses, CCTP domains, and USDC token addresses in `frontend/src/contracts.js`.

## Smart Contract

The contract in `contracts/src/TradeEscrow.sol` models the Arc onchain workflow:

1. Importer creates an invoice.
2. Importer funds escrow in USDC.
3. Financier optionally pays an advance to the exporter.
4. Importer releases escrow after delivery.
5. Contract updates participant settlement history for the SME credit passport.

For hackathon demo purposes, the frontend uses a Node API to simulate Circle developer tools and Arc transaction hashes. A production version would connect the API to Circle Wallets, Gateway, Bridge Kit, and deployed Arc testnet contract calls.

The current DApp uses the deployed Arc proxy for invoice actions, reads passport metrics onchain, uses the official testnet Gateway Wallet address for Arc deposits, and includes Circle App Kit dependencies for live CCTP testnet transfers.

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

See `SUBMISSION.md` for the judge-facing title, short description, Track 2 positioning, demo script, product mapping, and Circle Product Feedback.

Key runtime surfaces:

- React DApp with RainbowKit, wagmi, viem, Circle App Kit, and the Circle viem adapter.
- Node API for demo samples, IPFS upload fallback, Gateway balance proxying, and CCTP demo receipts.
- Arc testnet `TradeEscrow` proxy for invoices, financing, document hashes, passport metrics, and protocol fees.
- Settlement waterfall that repays financier principal plus accepted fee before exporter final payout.
- Circle Gateway for unified USDC balances and treasury routing.
- CCTP / Bridge Kit-style funding for source-chain USDC movement into Arc.
- Risk engine in the frontend for underwriting recommendations and bid prefill.
- Agent assistant for next-best-action recommendations and demo-safe automation.

## Circle Product Feedback

### Why These Products

USDC is the natural settlement rail for trade escrow because each party can reason in dollar-denominated amounts. Circle Wallets reduce onboarding friction for SMEs that are not crypto-native. Gateway fits treasury and payout routing, while CCTP with Bridge Kit covers cases where an importer or financier already holds USDC on another network.

### What Worked Well

The product boundaries are clear: Wallets for account/key UX, USDC for settlement, Gateway for operational routing, and CCTP for cross-chain movement. This makes it easy to explain which Circle component handles each part of the trade-finance workflow.

### What Could Be Improved

Hackathon teams benefit from complete sandbox examples that combine embedded wallets, CCTP, Gateway-style routing, and a sample EVM contract in one flow. The biggest lift is stitching docs across product surfaces into a single end-to-end testnet journey.

### Recommendations

Provide a reference "invoice escrow on Arc" sample app with mocked compliance attestations, testnet USDC funding steps, and deploy scripts. Add a small-business oriented dashboard example showing how transaction history can become a credit-passport data model.
