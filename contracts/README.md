# StableTrade Contracts

Upgradeable Arc Testnet contracts for StableTrade Passport.

## Active Stack

| Component | Address |
| --- | --- |
| TradeEscrow proxy | `0xF167a3f1E362dBDC7d365A9Cb9340C8513e7188b` |
| StableTradeFactory | `0x2d34ff5B7418e8c1Fcf3EAEc1aeC16EDc7aa6586` |
| Current frontend implementation reference | `0x6f62468D584406d177460Ad2353c7D2C19Ecf6bB` |
| Arc Testnet USDC | `0x3600000000000000000000000000000000000000` |
| Chain ID | `5042002` |

The DApp should keep using the proxy address. Implementation addresses change after upgrades.

## Versions

| Version | Contract | Main capability |
| --- | --- | --- |
| V1 | `TradeEscrowUpgradeable` | Invoice creation, escrow funding, advance payment, settlement, disputes, pause controls |
| V2 | `TradeEscrowUpgradeableV2` | Finance bids, exporter bid acceptance, document hashes, credit passport counters, delivery-proof-gated release |
| V3 | `TradeEscrowUpgradeableV3` | V2 plus protocol fees and settlement waterfall accounting |

Current code requires a `DocumentKind.DeliveryProof` document before `releaseOnDelivery(invoiceId)` succeeds. Existing deployed implementations do not pick up that requirement until you deploy the new implementation and upgrade the proxy.

## Fresh Clone Test Setup

This repo vendors a tiny `forge-std` compatibility shim under `contracts/lib/forge-std/src` so `forge test` works from a fresh clone without a network install.

```bash
cd contracts
forge build
forge test
```

## Upgrade V3 Proxy

Use the encrypted Foundry account already imported on your machine:

```bash
source .env
forge script script/UpgradeTradeEscrowV3.s.sol:UpgradeTradeEscrowV3 \
  --rpc-url $ARC_RPC_URL \
  --chain-id $ARC_CHAIN_ID \
  --account deploytestKey \
  --sender $OWNER \
  --broadcast
```

Required `.env` values:

```bash
ARC_RPC_URL=https://rpc.testnet.arc.network
ARC_CHAIN_ID=5042002
OWNER=0x...
STABLE_TRADE_FACTORY=0x2d34ff5B7418e8c1Fcf3EAEc1aeC16EDc7aa6586
TRADE_ESCROW_PROXY=0xF167a3f1E362dBDC7d365A9Cb9340C8513e7188b
FEE_RECIPIENT=0x...
PROTOCOL_FEE_BPS=50
```

After the script completes:

1. Copy the printed `TradeEscrow V3 implementation` address into `frontend/.env.local` if you want the System page to display the exact implementation reference.
2. Keep `VITE_TRADE_ESCROW_PROXY` unchanged.
3. Run `cast call $TRADE_ESCROW_PROXY "version()(string)" --rpc-url $ARC_RPC_URL` and confirm `3.0.0`.
4. Recheck the product walkthrough, because the delivery-proof gate only exists after the proxy upgrade.

## Settlement Rules

`releaseOnDelivery(invoiceId)` now checks:

- caller is the importer,
- invoice is `Escrowed` or `Advanced`,
- at least one `DeliveryProof` document hash exists,
- financier repayment does not exceed escrow,
- protocol fee is at most `300` bps and is configured by the owner.

For financed trades, the waterfall is:

1. Importer escrow funds the invoice.
2. Financier advances USDC to exporter after the exporter accepts a bid.
3. Importer anchors or verifies delivery proof.
4. Settlement repays financier principal plus accepted fee.
5. Protocol fee is deducted from the exporter remainder.
6. Exporter receives final payout.

## Tests

The tests cover:

- V2 bid acceptance and document anchoring,
- V2 release reverting without delivery proof,
- V3 protocol-fee settlement,
- V3 release reverting without delivery proof,
- upgradeable factory and proxy behavior.
