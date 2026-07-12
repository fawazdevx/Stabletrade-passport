// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Vm} from "./Vm.sol";

abstract contract Test {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function assertTrue(bool value) internal pure {
        require(value, "assertTrue failed");
    }

    function assertEq(address left, address right) internal pure {
        require(left == right, "assertEq(address) failed");
    }

    function assertEq(uint256 left, uint256 right) internal pure {
        require(left == right, "assertEq(uint256) failed");
    }

    function assertEq(string memory left, string memory right) internal pure {
        require(
            keccak256(bytes(left)) == keccak256(bytes(right)),
            "assertEq(string) failed"
        );
    }

    function assertGe(uint256 left, uint256 right) internal pure {
        require(left >= right, "assertGe(uint256) failed");
    }
}
