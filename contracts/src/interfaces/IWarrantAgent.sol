// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IWarrantAgent {
    enum ConditionType { RECEIPT, DELIVERY, MILESTONE, MANUAL }
    enum WarrantStatus { OPEN, CLAIMED, RELEASED, REFUNDED }

    struct Warrant {
        address sender;
        address receiver;
        uint256 amount;
        ConditionType conditionType;
        bytes32 ruleHash;
        string ruleURI;
        WarrantStatus status;
        uint256 expiresAt;
        bytes32 proofHash;
        string proofURI;
        address agentAddress;
        // Multi-currency payout (Mento): the local stable the receiver gets on
        // release. Equal to cUSD when no swap is requested. exchangeProvider /
        // exchangeId identify the Mento route, precomputed at creation.
        address payoutToken;
        address exchangeProvider;
        bytes32 exchangeId;
    }

    struct PayoutConfig {
        address token;
        address exchangeProvider;
        bytes32 exchangeId;
    }

    event WarrantCreated(
        uint256 indexed warrantId,
        address indexed sender,
        address indexed receiver,
        uint256 amount,
        ConditionType conditionType
    );
    event ProofSubmitted(
        uint256 indexed warrantId,
        address indexed submitter,
        bytes32 proofHash,
        string proofURI
    );
    event WarrantReleased(uint256 indexed warrantId, address indexed receiver, uint256 amount);
    event WarrantRejected(uint256 indexed warrantId, string reason);
    event WarrantRefunded(uint256 indexed warrantId, address indexed sender, uint256 amount);

    function createWarrant(
        address receiver,
        uint256 amount,
        ConditionType conditionType,
        string calldata ruleURI,
        uint256 expiresAt,
        PayoutConfig calldata payout
    ) external returns (uint256);

    function submitProof(
        uint256 warrantId,
        bytes32 proofHash,
        string calldata proofURI
    ) external;

    function agentRelease(uint256 warrantId) external;

    function agentReject(uint256 warrantId, string calldata reason) external;

    function refund(uint256 warrantId) external;
}
