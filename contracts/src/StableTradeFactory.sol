// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {StableTradeProxy} from "./StableTradeProxy.sol";
import {TradeEscrowUpgradeable} from "./TradeEscrowUpgradeable.sol";

contract StableTradeFactory {
    address public owner;
    address public latestImplementation;
    address[] private proxies;
    mapping(address => bool) public isStableTradeProxy;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ImplementationRegistered(address indexed implementation);
    event EscrowProxyDeployed(address indexed proxy, address indexed implementation, address indexed usdc, address owner);
    event EscrowProxyUpgraded(address indexed proxy, address indexed implementation);

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    constructor(address initialOwner, address initialImplementation) {
        require(initialOwner != address(0), "owner required");
        require(initialImplementation.code.length > 0, "implementation not contract");
        owner = initialOwner;
        latestImplementation = initialImplementation;
        emit OwnershipTransferred(address(0), initialOwner);
        emit ImplementationRegistered(initialImplementation);
    }

    function proxyCount() external view returns (uint256) {
        return proxies.length;
    }

    function proxyAt(uint256 index) external view returns (address) {
        return proxies[index];
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "owner required");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function registerImplementation(address implementation) external onlyOwner {
        require(implementation.code.length > 0, "implementation not contract");
        latestImplementation = implementation;
        emit ImplementationRegistered(implementation);
    }

    function deployEscrow(address usdc, address escrowOwner) external onlyOwner returns (address proxy) {
        bytes memory initData =
            abi.encodeCall(TradeEscrowUpgradeable.initialize, (usdc, escrowOwner));

        proxy = address(new StableTradeProxy(latestImplementation, address(this), initData));
        proxies.push(proxy);
        isStableTradeProxy[proxy] = true;

        emit EscrowProxyDeployed(proxy, latestImplementation, usdc, escrowOwner);
    }

    function upgradeEscrow(address payable proxy, address implementation) external onlyOwner {
        require(isStableTradeProxy[proxy], "unknown proxy");
        require(implementation.code.length > 0, "implementation not contract");
        StableTradeProxy(proxy).upgradeTo(implementation);
        latestImplementation = implementation;

        emit ImplementationRegistered(implementation);
        emit EscrowProxyUpgraded(proxy, implementation);
    }
}
