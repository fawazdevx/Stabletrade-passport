// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TradeEscrowUpgradeableV2} from "./TradeEscrowUpgradeableV2.sol";

contract TradeEscrowUpgradeableV3 is TradeEscrowUpgradeableV2 {
    address public feeRecipient;
    uint256 public protocolFeeBps;
    uint256 public protocolFeesAccrued;

    event ProtocolFeeUpdated(address indexed recipient, uint256 feeBps);
    event ProtocolFeeCollected(uint256 indexed invoiceId, uint256 feeAmount, address indexed recipient);

    function version() external pure override returns (string memory) {
        return "3.0.0";
    }

    function setProtocolFee(address recipient, uint256 feeBps) external onlyOwner {
        require(recipient != address(0), "recipient required");
        require(feeBps <= 300, "fee too high");
        feeRecipient = recipient;
        protocolFeeBps = feeBps;
        emit ProtocolFeeUpdated(recipient, feeBps);
    }

    function releaseOnDelivery(uint256 invoiceId) external override whenNotPaused {
        Invoice storage invoice = invoices[invoiceId];
        require(msg.sender == invoice.importer, "only importer");
        require(invoice.status == Status.Escrowed || invoice.status == Status.Advanced, "not releasable");
        _requireDeliveryProof(invoiceId);

        address importer = invoice.importer;
        address exporter = invoice.exporter;
        address financier = invoice.financier;

        invoice.status = Status.Settled;
        uint256 financeFee = financier == address(0) ? 0 : (invoice.advanceAmount * acceptedFinanceFeeBps(invoiceId)) / 10_000;
        uint256 financierRepayment = financier == address(0) ? 0 : invoice.advanceAmount + financeFee;
        require(financierRepayment <= invoice.amount, "repayment exceeds escrow");
        uint256 grossExporterPayout = invoice.amount - financierRepayment;
        uint256 feeAmount = feeRecipient == address(0) ? 0 : (grossExporterPayout * protocolFeeBps) / 10_000;
        uint256 exporterPayout = grossExporterPayout - feeAmount;

        if (financierRepayment > 0) {
            require(usdc.transfer(financier, financierRepayment), "repay failed");
        }
        if (feeAmount > 0) {
            protocolFeesAccrued += feeAmount;
            require(usdc.transfer(feeRecipient, feeAmount), "fee failed");
            emit ProtocolFeeCollected(invoiceId, feeAmount, feeRecipient);
        }
        require(usdc.transfer(exporter, exporterPayout), "payout failed");

        settledVolume[importer] += invoice.amount;
        settledVolume[exporter] += invoice.amount;
        if (financier != address(0)) {
            settledVolume[financier] += financierRepayment;
        }

        settledInvoiceCount[importer] += 1;
        settledInvoiceCount[exporter] += 1;
        if (financier != address(0)) {
            settledInvoiceCount[financier] += 1;
        }

        emit InvoiceSettled(invoiceId, exporterPayout, financierRepayment);
    }
}
