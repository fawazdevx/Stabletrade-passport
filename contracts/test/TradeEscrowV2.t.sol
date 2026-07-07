// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {StableTradeFactory} from "../src/StableTradeFactory.sol";
import {TradeEscrowUpgradeable} from "../src/TradeEscrowUpgradeable.sol";
import {TradeEscrowUpgradeableV2} from "../src/TradeEscrowUpgradeableV2.sol";
import {MockUSDC} from "./StableTradeFactory.t.sol";

contract TradeEscrowV2Test is Test {
    MockUSDC private usdc;
    StableTradeFactory private factory;
    TradeEscrowUpgradeableV2 private escrow;

    address private owner = address(0xA11CE);
    address private importer = address(0xB0B);
    address private exporter = address(0xCAFE);
    address private financier = address(0xF1);

    function setUp() public {
        usdc = new MockUSDC();
        TradeEscrowUpgradeable implementation = new TradeEscrowUpgradeable();

        vm.prank(owner);
        factory = new StableTradeFactory(owner, address(implementation));

        vm.prank(owner);
        address proxy = factory.deployEscrow(address(usdc), owner);

        TradeEscrowUpgradeableV2 implementationV2 = new TradeEscrowUpgradeableV2();
        vm.prank(owner);
        factory.upgradeEscrow(payable(proxy), address(implementationV2));
        escrow = TradeEscrowUpgradeableV2(proxy);
    }

    function testFinancierBiddingMarketplace() public {
        uint256 amount = 10_000e6;
        uint256 bidAmount = 8_500e6;
        uint256 feeBps = 250;

        usdc.mint(importer, amount);
        usdc.mint(financier, bidAmount);

        vm.prank(importer);
        uint256 invoiceId = escrow.createInvoice(exporter, amount, 0, keccak256("invoice"));

        vm.prank(importer);
        usdc.approve(address(escrow), amount);

        vm.prank(importer);
        escrow.fundEscrow(invoiceId);

        vm.prank(financier);
        uint256 bidIndex = escrow.submitFinanceBid(invoiceId, bidAmount, feeBps);

        vm.prank(financier);
        usdc.approve(address(escrow), bidAmount);

        vm.prank(exporter);
        escrow.acceptFinanceBid(invoiceId, bidIndex);

        assertEq(usdc.balanceOf(exporter), bidAmount);
        assertEq(escrow.financeBidCount(invoiceId), 1);
        assertEq(escrow.acceptedBidIndexPlusOne(invoiceId), bidIndex + 1);
        assertEq(escrow.acceptedFinanceFeeBps(invoiceId), feeBps);
    }

    function testFinancierEarnsFeeOnSettlement() public {
        uint256 amount = 10_000e6;
        uint256 bidAmount = 8_000e6;
        uint256 feeBps = 250;
        uint256 financeFee = (bidAmount * feeBps) / 10_000;

        usdc.mint(importer, amount);
        usdc.mint(financier, bidAmount);

        vm.prank(importer);
        uint256 invoiceId = escrow.createInvoice(exporter, amount, 0, keccak256("invoice"));

        vm.prank(importer);
        usdc.approve(address(escrow), amount);

        vm.prank(importer);
        escrow.fundEscrow(invoiceId);

        vm.prank(financier);
        uint256 bidIndex = escrow.submitFinanceBid(invoiceId, bidAmount, feeBps);

        vm.prank(financier);
        usdc.approve(address(escrow), bidAmount);

        vm.prank(exporter);
        escrow.acceptFinanceBid(invoiceId, bidIndex);

        vm.prank(importer);
        escrow.releaseOnDelivery(invoiceId);

        assertEq(usdc.balanceOf(financier), bidAmount + financeFee);
        assertEq(usdc.balanceOf(exporter), bidAmount + amount - bidAmount - financeFee);
    }

    function testDocumentHashesAndPassport() public {
        uint256 amount = 12_000e6;
        bytes32 documentHash = keccak256("ipfs://invoice-pdf");

        usdc.mint(importer, amount);

        vm.prank(importer);
        uint256 invoiceId = escrow.createInvoice(exporter, amount, 0, keccak256("metadata"));

        vm.prank(importer);
        escrow.addTradeDocument(invoiceId, TradeEscrowUpgradeableV2.DocumentKind.Invoice, documentHash);

        assertEq(escrow.tradeDocumentCount(invoiceId), 1);

        vm.prank(importer);
        usdc.approve(address(escrow), amount);

        vm.prank(importer);
        escrow.fundEscrow(invoiceId);

        vm.prank(importer);
        escrow.releaseOnDelivery(invoiceId);

        (uint256 created, uint256 settled, uint256 disputed, uint256 volume, uint256 score) = escrow.passport(importer);
        assertEq(created, 1);
        assertEq(settled, 1);
        assertEq(disputed, 0);
        assertEq(volume, amount);
        assertGe(score, 90);
    }
}
