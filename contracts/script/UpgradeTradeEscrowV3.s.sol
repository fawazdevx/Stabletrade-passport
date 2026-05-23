// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {StableTradeFactory} from "../src/StableTradeFactory.sol";
import {TradeEscrowUpgradeableV3} from "../src/TradeEscrowUpgradeableV3.sol";

contract UpgradeTradeEscrowV3 is Script {
    function run() external returns (TradeEscrowUpgradeableV3 implementationV3) {
        address payable proxy = payable(vm.envAddress("TRADE_ESCROW_PROXY"));
        address factoryAddress = vm.envAddress("STABLE_TRADE_FACTORY");
        address feeRecipient = vm.envOr("FEE_RECIPIENT", vm.envAddress("OWNER"));
        uint256 feeBps = vm.envOr("PROTOCOL_FEE_BPS", uint256(50));

        vm.startBroadcast();
        implementationV3 = new TradeEscrowUpgradeableV3();
        StableTradeFactory(factoryAddress).upgradeEscrow(proxy, address(implementationV3));
        TradeEscrowUpgradeableV3(proxy).setProtocolFee(feeRecipient, feeBps);
        vm.stopBroadcast();

        console2.log("TradeEscrow V3 implementation:", address(implementationV3));
        console2.log("Upgraded proxy:", proxy);
        console2.log("Factory:", factoryAddress);
        console2.log("Fee recipient:", feeRecipient);
        console2.log("Protocol fee bps:", feeBps);
    }
}
