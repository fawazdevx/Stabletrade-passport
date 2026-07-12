// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface Vm {
    function prank(address msgSender) external;
    function expectRevert(bytes calldata revertData) external;
    function expectRevert(bytes4 revertData) external;
    function expectRevert(bytes calldata revertData, address reverter) external;
    function envAddress(string calldata name) external view returns (address value);
    function envOr(string calldata name, address defaultValue) external view returns (address value);
    function envOr(string calldata name, uint256 defaultValue) external view returns (uint256 value);
    function startBroadcast() external;
    function stopBroadcast() external;
}
