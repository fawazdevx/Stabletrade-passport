// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TradeEscrowUpgradeable} from "./TradeEscrowUpgradeable.sol";

contract TradeEscrowUpgradeableV2 is TradeEscrowUpgradeable {
    enum DocumentKind {
        PurchaseOrder,
        Invoice,
        DeliveryProof,
        Compliance,
        Other
    }

    struct FinanceBid {
        address financier;
        uint256 advanceAmount;
        uint256 feeBps;
        bool accepted;
        bool cancelled;
    }

    struct TradeDocument {
        address uploader;
        DocumentKind kind;
        bytes32 documentHash;
        uint256 timestamp;
    }

    mapping(uint256 => FinanceBid[]) private financeBids;
    mapping(uint256 => TradeDocument[]) private tradeDocuments;
    mapping(uint256 => uint256) public acceptedBidIndexPlusOne;
    mapping(address => uint256) public createdInvoiceCount;
    mapping(address => uint256) public settledInvoiceCount;
    mapping(address => uint256) public disputedInvoiceCount;

    event FinanceBidSubmitted(uint256 indexed invoiceId, uint256 indexed bidIndex, address indexed financier, uint256 advanceAmount, uint256 feeBps);
    event FinanceBidCancelled(uint256 indexed invoiceId, uint256 indexed bidIndex);
    event FinanceBidAccepted(uint256 indexed invoiceId, uint256 indexed bidIndex, address indexed financier, uint256 advanceAmount, uint256 feeBps);
    event TradeDocumentAdded(uint256 indexed invoiceId, address indexed uploader, DocumentKind kind, bytes32 documentHash);

    function version() external pure virtual override returns (string memory) {
        return "2.0.0";
    }

    function createInvoice(address exporter, uint256 amount, uint256 advanceAmount, bytes32 metadataHash)
        external
        override
        whenNotPaused
        returns (uint256 invoiceId)
    {
        invoiceId = _createInvoice(exporter, amount, advanceAmount, metadataHash);
        createdInvoiceCount[msg.sender] += 1;
    }

    function submitFinanceBid(uint256 invoiceId, uint256 advanceAmount, uint256 feeBps) external whenNotPaused returns (uint256 bidIndex) {
        Invoice storage invoice = invoices[invoiceId];
        require(invoice.importer != address(0), "invoice missing");
        require(invoice.status == Status.Escrowed, "not escrowed");
        require(msg.sender != invoice.importer && msg.sender != invoice.exporter, "party cannot bid");
        require(advanceAmount > 0 && advanceAmount <= invoice.amount, "invalid advance");
        require(feeBps <= 2_000, "fee too high");

        bidIndex = financeBids[invoiceId].length;
        financeBids[invoiceId].push(FinanceBid({
            financier: msg.sender,
            advanceAmount: advanceAmount,
            feeBps: feeBps,
            accepted: false,
            cancelled: false
        }));

        emit FinanceBidSubmitted(invoiceId, bidIndex, msg.sender, advanceAmount, feeBps);
    }

    function cancelFinanceBid(uint256 invoiceId, uint256 bidIndex) external {
        FinanceBid storage bid = financeBids[invoiceId][bidIndex];
        require(msg.sender == bid.financier, "only financier");
        require(!bid.accepted, "accepted");
        bid.cancelled = true;
        emit FinanceBidCancelled(invoiceId, bidIndex);
    }

    function acceptFinanceBid(uint256 invoiceId, uint256 bidIndex) external whenNotPaused {
        Invoice storage invoice = invoices[invoiceId];
        require(msg.sender == invoice.exporter, "only exporter");
        require(invoice.status == Status.Escrowed, "not escrowed");
        require(acceptedBidIndexPlusOne[invoiceId] == 0, "bid accepted");

        FinanceBid storage bid = financeBids[invoiceId][bidIndex];
        require(!bid.cancelled, "cancelled");

        bid.accepted = true;
        acceptedBidIndexPlusOne[invoiceId] = bidIndex + 1;
        invoice.financier = bid.financier;
        invoice.advanceAmount = bid.advanceAmount;
        invoice.status = Status.Advanced;

        require(usdc.transferFrom(bid.financier, invoice.exporter, bid.advanceAmount), "advance failed");

        emit FinanceBidAccepted(invoiceId, bidIndex, bid.financier, bid.advanceAmount, bid.feeBps);
        emit AdvancePaid(invoiceId, bid.financier, bid.advanceAmount);
    }

    function addTradeDocument(uint256 invoiceId, DocumentKind kind, bytes32 documentHash) external whenNotPaused {
        Invoice storage invoice = invoices[invoiceId];
        require(invoice.importer != address(0), "invoice missing");
        require(msg.sender == invoice.importer || msg.sender == invoice.exporter || msg.sender == invoice.financier || msg.sender == owner, "not authorized");
        require(documentHash != bytes32(0), "hash required");

        tradeDocuments[invoiceId].push(TradeDocument({
            uploader: msg.sender,
            kind: kind,
            documentHash: documentHash,
            timestamp: block.timestamp
        }));

        emit TradeDocumentAdded(invoiceId, msg.sender, kind, documentHash);
    }

    function releaseOnDelivery(uint256 invoiceId) external virtual override whenNotPaused {
        Invoice storage invoice = invoices[invoiceId];
        require(msg.sender == invoice.importer, "only importer");
        require(invoice.status == Status.Escrowed || invoice.status == Status.Advanced, "not releasable");

        address importer = invoice.importer;
        address exporter = invoice.exporter;
        address financier = invoice.financier;
        uint256 amount = invoice.amount;
        uint256 financierRepayment = 0;
        uint256 financeFee = 0;
        if (financier != address(0)) {
            financeFee = (invoice.advanceAmount * acceptedFinanceFeeBps(invoiceId)) / 10_000;
            financierRepayment = invoice.advanceAmount + financeFee;
            require(financierRepayment <= amount, "repayment exceeds escrow");
        }
        uint256 exporterPayout = amount - financierRepayment;

        invoice.status = Status.Settled;

        if (financierRepayment > 0) {
            require(usdc.transfer(financier, financierRepayment), "repay failed");
        }
        require(usdc.transfer(exporter, exporterPayout), "payout failed");

        settledVolume[importer] += amount;
        settledVolume[exporter] += amount;
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

    function dispute(uint256 invoiceId) external virtual override whenNotPaused {
        Invoice storage invoice = invoices[invoiceId];
        address importer = invoice.importer;
        address exporter = invoice.exporter;

        _dispute(invoiceId);

        disputedInvoiceCount[importer] += 1;
        disputedInvoiceCount[exporter] += 1;
    }

    function financeBidCount(uint256 invoiceId) external view returns (uint256) {
        return financeBids[invoiceId].length;
    }

    function financeBid(uint256 invoiceId, uint256 bidIndex) external view returns (FinanceBid memory) {
        return financeBids[invoiceId][bidIndex];
    }

    function acceptedFinanceFeeBps(uint256 invoiceId) public view returns (uint256) {
        uint256 bidIndexPlusOne = acceptedBidIndexPlusOne[invoiceId];
        if (bidIndexPlusOne == 0) {
            return 0;
        }
        return financeBids[invoiceId][bidIndexPlusOne - 1].feeBps;
    }

    function tradeDocumentCount(uint256 invoiceId) external view returns (uint256) {
        return tradeDocuments[invoiceId].length;
    }

    function tradeDocument(uint256 invoiceId, uint256 documentIndex) external view returns (TradeDocument memory) {
        return tradeDocuments[invoiceId][documentIndex];
    }

    function passport(address account)
        external
        view
        returns (uint256 created, uint256 settled, uint256 disputed, uint256 volume, uint256 score)
    {
        created = createdInvoiceCount[account];
        settled = settledInvoiceCount[account];
        disputed = disputedInvoiceCount[account];
        volume = settledVolume[account];

        score = 50;
        if (settled > 0) score += 25;
        if (volume >= 10_000e6) score += 15;
        if (created >= 3) score += 5;
        if (disputed > 0) score -= disputed > 4 ? 25 : disputed * 5;
        if (score > 100) score = 100;
    }
}
