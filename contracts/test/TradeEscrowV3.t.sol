// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {StableTradeFactory} from "../src/StableTradeFactory.sol";
import {TradeEscrowUpgradeable} from "../src/TradeEscrowUpgradeable.sol";
import {TradeEscrowUpgradeableV3} from "../src/TradeEscrowUpgradeableV3.sol";
import {MockUSDC} from "./StableTradeFactory.t.sol";

contract TradeEscrowV3Test is Test {
    MockUSDC private usdc;
    StableTradeFactory private factory;
    TradeEscrowUpgradeableV3 private escrow;

    address private owner = address(0xA11CE);
    address private importer = address(0xB0B);
    address private exporter = address(0xCAFE);
    address private feeRecipient = address(0xFEE);

    function setUp() public {
        usdc = new MockUSDC();
        TradeEscrowUpgradeable implementation = new TradeEscrowUpgradeable();

        vm.prank(owner);
        factory = new StableTradeFactory(owner, address(implementation));

        vm.prank(owner);
        address proxy = factory.deployEscrow(address(usdc), owner);

        TradeEscrowUpgradeableV3 implementationV3 = new TradeEscrowUpgradeableV3();
        vm.prank(owner);
        factory.upgradeEscrow(payable(proxy), address(implementationV3));
        escrow = TradeEscrowUpgradeableV3(proxy);

        vm.prank(owner);
        escrow.setProtocolFee(feeRecipient, 100);
    }

    function testProtocolFeeOnSettlement() public {
        uint256 amount = 10_000e6;
        uint256 expectedFee = 100e6;

        usdc.mint(importer, amount);

        vm.prank(importer);
        uint256 invoiceId = escrow.createInvoice(exporter, amount, 0, keccak256("metadata"));

        vm.prank(importer);
        usdc.approve(address(escrow), amount);

        vm.prank(importer);
        escrow.fundEscrow(invoiceId);

        vm.prank(importer);
        escrow.releaseOnDelivery(invoiceId);

        assertEq(usdc.balanceOf(feeRecipient), expectedFee);
        assertEq(usdc.balanceOf(exporter), amount - expectedFee);
        assertEq(escrow.protocolFeesAccrued(), expectedFee);
    }
}
