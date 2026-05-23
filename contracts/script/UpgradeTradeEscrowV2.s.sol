// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {StableTradeFactory} from "../src/StableTradeFactory.sol";
import {TradeEscrowUpgradeableV2} from "../src/TradeEscrowUpgradeableV2.sol";

contract UpgradeTradeEscrowV2 is Script {
    function run() external returns (TradeEscrowUpgradeableV2 implementationV2) {
        address payable proxy = payable(vm.envAddress("TRADE_ESCROW_PROXY"));
        address factoryAddress = vm.envAddress("STABLE_TRADE_FACTORY");

        vm.startBroadcast();
        implementationV2 = new TradeEscrowUpgradeableV2();
        StableTradeFactory(factoryAddress).upgradeEscrow(proxy, address(implementationV2));
        vm.stopBroadcast();

        console2.log("TradeEscrow V2 implementation:", address(implementationV2));
        console2.log("Upgraded proxy:", proxy);
        console2.log("Factory:", factoryAddress);
    }
}
