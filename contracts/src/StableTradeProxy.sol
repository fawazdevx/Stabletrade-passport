// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract StableTradeProxy {
    // keccak256("eip1967.proxy.implementation") - 1
    bytes32 private constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    // keccak256("eip1967.proxy.admin") - 1
    bytes32 private constant ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

    event Upgraded(address indexed implementation);
    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);

    constructor(address implementation_, address admin_, bytes memory data) payable {
        require(implementation_.code.length > 0, "implementation not contract");
        require(admin_ != address(0), "admin required");

        _setAdmin(admin_);
        _setImplementation(implementation_);

        if (data.length > 0) {
            (bool ok, bytes memory reason) = implementation_.delegatecall(data);
            if (!ok) {
                assembly {
                    revert(add(reason, 32), mload(reason))
                }
            }
        }
    }

    modifier onlyAdmin() {
        require(msg.sender == _admin(), "only admin");
        _;
    }

    function admin() external view onlyAdmin returns (address) {
        return _admin();
    }

    function implementation() external view onlyAdmin returns (address) {
        return _implementation();
    }

    function changeAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "admin required");
        address previousAdmin = _admin();
        _setAdmin(newAdmin);
        emit AdminChanged(previousAdmin, newAdmin);
    }

    function upgradeTo(address newImplementation) external onlyAdmin {
        require(newImplementation.code.length > 0, "implementation not contract");
        _setImplementation(newImplementation);
        emit Upgraded(newImplementation);
    }

    fallback() external payable {
        _fallback();
    }

    receive() external payable {
        _fallback();
    }

    function _fallback() private {
        address implementation_ = _implementation();
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), implementation_, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    function _implementation() private view returns (address implementation_) {
        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly {
            implementation_ := sload(slot)
        }
    }

    function _admin() private view returns (address admin_) {
        bytes32 slot = ADMIN_SLOT;
        assembly {
            admin_ := sload(slot)
        }
    }

    function _setImplementation(address implementation_) private {
        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly {
            sstore(slot, implementation_)
        }
    }

    function _setAdmin(address admin_) private {
        bytes32 slot = ADMIN_SLOT;
        assembly {
            sstore(slot, admin_)
        }
    }
}
