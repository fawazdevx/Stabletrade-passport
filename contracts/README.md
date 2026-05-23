## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
- **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```

### Deploy Legacy TradeEscrow

Copy the example environment file and fill in Arc testnet values:

```shell
$ cp .env.example .env
```

Required values:

- `ARC_RPC_URL`: Arc testnet RPC URL.
- `ARC_CHAIN_ID`: Arc testnet chain ID.
- `OWNER`: deployer address.
- `USDC_ADDRESS`: Arc testnet USDC token address.

This deploy script uses `vm.startBroadcast()` so Forge can use the signer you provide on the command line, including `--account`.

Deploy:

```shell
$ source .env
$ forge script script/DeployTradeEscrow.s.sol:DeployTradeEscrow --rpc-url $ARC_RPC_URL --chain-id $ARC_CHAIN_ID --account deploytestKey --sender $OWNER --broadcast
```

For a local dry run without broadcasting:

```shell
$ source .env
$ forge script script/DeployTradeEscrow.s.sol:DeployTradeEscrow --rpc-url $ARC_RPC_URL --chain-id $ARC_CHAIN_ID --account deploytestKey --sender $OWNER
```

### Deploy Upgradeable StableTrade Stack

Use this for the production hackathon demo path. It deploys:

- `TradeEscrowUpgradeable`: implementation contract.
- `StableTradeFactory`: owner-controlled factory and proxy admin.
- `StableTradeProxy`: EIP-1967-style proxy initialized with USDC and owner.

```shell
$ source .env
$ forge script script/DeployStableTradeFactory.s.sol:DeployStableTradeFactory --rpc-url $ARC_RPC_URL --chain-id $ARC_CHAIN_ID --account deploytestKey --sender $OWNER --broadcast
```

The script prints three important addresses:

- `TradeEscrow implementation`
- `StableTradeFactory`
- `TradeEscrow proxy`

Use the proxy address in the DApp. The implementation address can change after upgrades, but the proxy address should remain the stable application address.

### Upgrade Flow

For future updates:

1. Deploy a new implementation contract.
2. Call `StableTradeFactory.upgradeEscrow(proxy, newImplementation)` from the factory owner.
3. Keep using the same proxy address in the frontend.

The included tests cover proxy initialization, escrow settlement, pause controls, and factory-driven upgrades.

### Upgrade to TradeEscrow V2

V2 adds:

- Financier bid marketplace.
- Exporter bid acceptance.
- Document hash anchoring.
- Credit passport counters and score.

Add these values to `.env`:

```shell
STABLE_TRADE_FACTORY=0x2d34ff5B7418e8c1Fcf3EAEc1aeC16EDc7aa6586
TRADE_ESCROW_PROXY=0xF167a3f1E362dBDC7d365A9Cb9340C8513e7188b
```

Then run:

```shell
$ source .env
$ forge script script/UpgradeTradeEscrowV2.s.sol:UpgradeTradeEscrowV2 --rpc-url $ARC_RPC_URL --chain-id $ARC_CHAIN_ID --account deploytestKey --sender $OWNER --broadcast
```

After the upgrade, the frontend will detect `version() == "2.0.0"` and enable marketplace bids, bid acceptance, document hashes, and contract-native passport analytics.

### Upgrade to TradeEscrow V3

V3 adds protocol fees so the platform owner can earn from settled trade flows.

```shell
FEE_RECIPIENT=0xyour_fee_recipient_address
PROTOCOL_FEE_BPS=50
```

`50` bps means `0.5%` of the exporter payout on settlement.

Upgrade:

```shell
$ source .env
$ forge script script/UpgradeTradeEscrowV3.s.sol:UpgradeTradeEscrowV3 --rpc-url $ARC_RPC_URL --chain-id $ARC_CHAIN_ID --account deploytestKey --sender $OWNER --broadcast
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```
