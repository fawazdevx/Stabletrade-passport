// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
}

contract TradeEscrow {
    enum Status {
        Draft,
        Escrowed,
        Advanced,
        Settled,
        Disputed
    }

    struct Invoice {
        address importer;
        address exporter;
        address financier;
        uint256 amount;
        uint256 advanceAmount;
        Status status;
        bytes32 metadataHash;
    }

    IERC20 public immutable usdc;
    uint256 public nextInvoiceId = 1;
    mapping(uint256 => Invoice) public invoices;
    mapping(address => uint256) public settledVolume;

    event InvoiceCreated(uint256 indexed invoiceId, address indexed importer, address indexed exporter, uint256 amount, bytes32 metadataHash);
    event EscrowFunded(uint256 indexed invoiceId, uint256 amount);
    event AdvancePaid(uint256 indexed invoiceId, address indexed financier, uint256 advanceAmount);
    event InvoiceSettled(uint256 indexed invoiceId, uint256 exporterPayout, uint256 financierRepayment);
    event InvoiceDisputed(uint256 indexed invoiceId);

    constructor(address usdcAddress) {
        usdc = IERC20(usdcAddress);
    }

    function createInvoice(address exporter, uint256 amount, uint256 advanceAmount, bytes32 metadataHash) external returns (uint256 invoiceId) {
        require(exporter != address(0), "exporter required");
        require(amount > 0, "amount required");
        require(advanceAmount <= amount, "advance too high");

        invoiceId = nextInvoiceId++;
        invoices[invoiceId] = Invoice({
            importer: msg.sender,
            exporter: exporter,
            financier: address(0),
            amount: amount,
            advanceAmount: advanceAmount,
            status: Status.Draft,
            metadataHash: metadataHash
        });

        emit InvoiceCreated(invoiceId, msg.sender, exporter, amount, metadataHash);
    }

    function fundEscrow(uint256 invoiceId) external {
        Invoice storage invoice = invoices[invoiceId];
        require(msg.sender == invoice.importer, "only importer");
        require(invoice.status == Status.Draft, "not draft");

        invoice.status = Status.Escrowed;
        require(usdc.transferFrom(msg.sender, address(this), invoice.amount), "transfer failed");

        emit EscrowFunded(invoiceId, invoice.amount);
    }

    function payAdvance(uint256 invoiceId) external {
        Invoice storage invoice = invoices[invoiceId];
        require(invoice.status == Status.Escrowed, "not escrowed");
        require(invoice.advanceAmount > 0, "no advance");

        invoice.financier = msg.sender;
        invoice.status = Status.Advanced;
        require(usdc.transferFrom(msg.sender, invoice.exporter, invoice.advanceAmount), "advance failed");

        emit AdvancePaid(invoiceId, msg.sender, invoice.advanceAmount);
    }

    function releaseOnDelivery(uint256 invoiceId) external {
        Invoice storage invoice = invoices[invoiceId];
        require(msg.sender == invoice.importer, "only importer");
        require(invoice.status == Status.Escrowed || invoice.status == Status.Advanced, "not releasable");

        invoice.status = Status.Settled;
        uint256 financierRepayment = invoice.financier == address(0) ? 0 : invoice.advanceAmount;
        uint256 exporterPayout = invoice.amount - financierRepayment;

        if (financierRepayment > 0) {
            require(usdc.transfer(invoice.financier, financierRepayment), "repay failed");
        }
        require(usdc.transfer(invoice.exporter, exporterPayout), "payout failed");

        settledVolume[invoice.importer] += invoice.amount;
        settledVolume[invoice.exporter] += invoice.amount;
        if (invoice.financier != address(0)) {
            settledVolume[invoice.financier] += financierRepayment;
        }

        emit InvoiceSettled(invoiceId, exporterPayout, financierRepayment);
    }

    function dispute(uint256 invoiceId) external {
        Invoice storage invoice = invoices[invoiceId];
        require(msg.sender == invoice.importer || msg.sender == invoice.exporter, "not party");
        require(invoice.status == Status.Escrowed || invoice.status == Status.Advanced, "not disputable");

        invoice.status = Status.Disputed;
        emit InvoiceDisputed(invoiceId);
    }
}
