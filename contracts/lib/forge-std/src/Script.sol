// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Vm} from "./Vm.sol";

abstract contract Script {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
}

library console2 {
    function log(string memory) internal pure {}
    function log(string memory, address) internal pure {}
    function log(string memory, uint256) internal pure {}
}
