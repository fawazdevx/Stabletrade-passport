// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {StableTradeFactory} from "../src/StableTradeFactory.sol";
import {TradeEscrowUpgradeable} from "../src/TradeEscrowUpgradeable.sol";

contract DeployStableTradeFactory is Script {
    function run() external returns (TradeEscrowUpgradeable implementation, StableTradeFactory factory, address proxy) {
        address usdc = vm.envAddress("USDC_ADDRESS");
        address owner = vm.envAddress("OWNER");

        vm.startBroadcast();
        implementation = new TradeEscrowUpgradeable();
        factory = new StableTradeFactory(owner, address(implementation));
        proxy = factory.deployEscrow(usdc, owner);
        vm.stopBroadcast();

        console2.log("TradeEscrow implementation:", address(implementation));
        console2.log("StableTradeFactory:", address(factory));
        console2.log("TradeEscrow proxy:", proxy);
        console2.log("USDC address:", usdc);
        console2.log("Owner:", owner);
    }
}
