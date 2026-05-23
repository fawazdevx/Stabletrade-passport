// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Upgradeable {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
}

contract TradeEscrowUpgradeable {
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

    IERC20Upgradeable public usdc;
    address public owner;
    uint256 public nextInvoiceId;
    bool public paused;
    bool private initialized;

    mapping(uint256 => Invoice) public invoices;
    mapping(address => uint256) public settledVolume;

    event Initialized(address indexed owner, address indexed usdc);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event PauseUpdated(bool paused);
    event InvoiceCreated(uint256 indexed invoiceId, address indexed importer, address indexed exporter, uint256 amount, bytes32 metadataHash);
    event EscrowFunded(uint256 indexed invoiceId, uint256 amount);
    event AdvancePaid(uint256 indexed invoiceId, address indexed financier, uint256 advanceAmount);
    event InvoiceSettled(uint256 indexed invoiceId, uint256 exporterPayout, uint256 financierRepayment);
    event InvoiceDisputed(uint256 indexed invoiceId);

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "paused");
        _;
    }

    function initialize(address usdcAddress, address initialOwner) external {
        require(!initialized, "already initialized");
        require(usdcAddress != address(0), "usdc required");
        require(initialOwner != address(0), "owner required");

        initialized = true;
        usdc = IERC20Upgradeable(usdcAddress);
        owner = initialOwner;
        nextInvoiceId = 1;

        emit Initialized(initialOwner, usdcAddress);
        emit OwnershipTransferred(address(0), initialOwner);
    }

    function version() external pure virtual returns (string memory) {
        return "1.0.0";
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "owner required");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setPaused(bool value) external onlyOwner {
        paused = value;
        emit PauseUpdated(value);
    }

    function createInvoice(address exporter, uint256 amount, uint256 advanceAmount, bytes32 metadataHash)
        external
        virtual
        whenNotPaused
        returns (uint256 invoiceId)
    {
        invoiceId = _createInvoice(exporter, amount, advanceAmount, metadataHash);
    }

    function _createInvoice(address exporter, uint256 amount, uint256 advanceAmount, bytes32 metadataHash)
        internal
        returns (uint256 invoiceId)
    {
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

    function fundEscrow(uint256 invoiceId) external whenNotPaused {
        Invoice storage invoice = invoices[invoiceId];
        require(msg.sender == invoice.importer, "only importer");
        require(invoice.status == Status.Draft, "not draft");

        invoice.status = Status.Escrowed;
        require(usdc.transferFrom(msg.sender, address(this), invoice.amount), "transfer failed");

        emit EscrowFunded(invoiceId, invoice.amount);
    }

    function payAdvance(uint256 invoiceId) external whenNotPaused {
        Invoice storage invoice = invoices[invoiceId];
        require(invoice.status == Status.Escrowed, "not escrowed");
        require(invoice.advanceAmount > 0, "no advance");

        invoice.financier = msg.sender;
        invoice.status = Status.Advanced;
        require(usdc.transferFrom(msg.sender, invoice.exporter, invoice.advanceAmount), "advance failed");

        emit AdvancePaid(invoiceId, msg.sender, invoice.advanceAmount);
    }

    function releaseOnDelivery(uint256 invoiceId) external virtual whenNotPaused {
        _releaseOnDelivery(invoiceId);
    }

    function _releaseOnDelivery(uint256 invoiceId) internal {
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

    function dispute(uint256 invoiceId) external virtual whenNotPaused {
        _dispute(invoiceId);
    }

    function _dispute(uint256 invoiceId) internal {
        Invoice storage invoice = invoices[invoiceId];
        require(msg.sender == invoice.importer || msg.sender == invoice.exporter, "not party");
        require(invoice.status == Status.Escrowed || invoice.status == Status.Advanced, "not disputable");

        invoice.status = Status.Disputed;
        emit InvoiceDisputed(invoiceId);
    }
}
