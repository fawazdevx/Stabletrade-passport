// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {TradeEscrow} from "../src/TradeEscrow.sol";

contract DeployTradeEscrow is Script {
    function run() external returns (TradeEscrow tradeEscrow) {
        address usdc = vm.envAddress("USDC_ADDRESS");

        vm.startBroadcast();
        tradeEscrow = new TradeEscrow(usdc);
        vm.stopBroadcast();

        console2.log("TradeEscrow deployed at:", address(tradeEscrow));
        console2.log("USDC address:", usdc);
    }
}
