// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {StableTradeFactory} from "../src/StableTradeFactory.sol";
import {TradeEscrowUpgradeable} from "../src/TradeEscrowUpgradeable.sol";

contract MockUSDC {
    string public constant name = "Mock USDC";
    string public constant symbol = "USDC";
    uint8 public constant decimals = 6;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "insufficient balance");
        require(allowance[from][msg.sender] >= amount, "insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract TradeEscrowUpgradeableV2 is TradeEscrowUpgradeable {
    function version() external pure override returns (string memory) {
        return "2.0.0";
    }

    function newFeatureFlag() external pure returns (bool) {
        return true;
    }
}

contract StableTradeFactoryTest is Test {
    MockUSDC private usdc;
    TradeEscrowUpgradeable private implementation;
    StableTradeFactory private factory;
    TradeEscrowUpgradeable private escrow;

    address private owner = address(0xA11CE);
    address private importer = address(0xB0B);
    address private exporter = address(0xCAFE);
    address private financier = address(0xF1);

    function setUp() public {
        usdc = new MockUSDC();
        implementation = new TradeEscrowUpgradeable();

        vm.prank(owner);
        factory = new StableTradeFactory(owner, address(implementation));

        vm.prank(owner);
        address proxy = factory.deployEscrow(address(usdc), owner);
        escrow = TradeEscrowUpgradeable(proxy);
    }

    function testDeploysInitializedProxy() public view {
        assertEq(address(escrow.usdc()), address(usdc));
        assertEq(escrow.owner(), owner);
        assertEq(escrow.nextInvoiceId(), 1);
        assertEq(factory.proxyCount(), 1);
        assertTrue(factory.isStableTradeProxy(address(escrow)));
        assertEq(escrow.version(), "1.0.0");
    }

    function testEscrowAdvanceAndSettlementFlow() public {
        uint256 amount = 10_000e6;
        uint256 advanceAmount = 8_000e6;
        bytes32 metadataHash = keccak256("invoice-001");

        usdc.mint(importer, amount);
        usdc.mint(financier, advanceAmount);

        vm.prank(importer);
        uint256 invoiceId = escrow.createInvoice(exporter, amount, advanceAmount, metadataHash);

        vm.prank(importer);
        usdc.approve(address(escrow), amount);

        vm.prank(importer);
        escrow.fundEscrow(invoiceId);

        vm.prank(financier);
        usdc.approve(address(escrow), advanceAmount);

        vm.prank(financier);
        escrow.payAdvance(invoiceId);

        assertEq(usdc.balanceOf(exporter), advanceAmount);

        vm.prank(importer);
        escrow.releaseOnDelivery(invoiceId);

        assertEq(usdc.balanceOf(financier), advanceAmount);
        assertEq(usdc.balanceOf(exporter), amount);
        assertEq(escrow.settledVolume(importer), amount);
        assertEq(escrow.settledVolume(exporter), amount);
    }

    function testOnlyOwnerCanPause() public {
        vm.prank(importer);
        vm.expectRevert("only owner");
        escrow.setPaused(true);

        vm.prank(owner);
        escrow.setPaused(true);

        vm.prank(importer);
        vm.expectRevert("paused");
        escrow.createInvoice(exporter, 100e6, 50e6, bytes32(0));
    }

    function testFactoryCanUpgradeKnownProxy() public {
        TradeEscrowUpgradeableV2 implementationV2 = new TradeEscrowUpgradeableV2();

        vm.prank(owner);
        factory.upgradeEscrow(payable(address(escrow)), address(implementationV2));

        TradeEscrowUpgradeableV2 upgraded = TradeEscrowUpgradeableV2(address(escrow));
        assertEq(upgraded.version(), "2.0.0");
        assertTrue(upgraded.newFeatureFlag());
        assertEq(upgraded.owner(), owner);
        assertEq(address(upgraded.usdc()), address(usdc));
    }
}
