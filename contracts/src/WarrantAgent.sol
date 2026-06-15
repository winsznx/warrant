// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IWarrantAgent} from "./interfaces/IWarrantAgent.sol";
import {IERC8004Registry} from "./interfaces/IERC8004.sol";
import {IMentoBroker, IMentoExchangeProvider} from "./interfaces/IMentoBroker.sol";

/// @title WarrantAgent
/// @notice Holds cUSD in escrow and releases it only when a real-world condition
///         is verified by a registered ERC-8004 agent. Implements the
///         `lock money → define condition → submit proof → agent releases` flow.
/// @dev Funds are never transferable by the agent directly: the agent can only
///      call `agentRelease`/`agentReject`, which move funds along predefined
///      paths. All state transitions follow checks-effects-interactions and are
///      `nonReentrant`.
contract WarrantAgent is IWarrantAgent, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice The escrowed stablecoin (cUSD on Celo).
    IERC20 public immutable cUSD;

    /// @notice Optional ERC-8004 registry used to authorize agent callers.
    IERC8004Registry public immutable agentRegistry;

    /// @notice Optional Mento Broker used to swap cUSD into a receiver's chosen
    ///         local stable on release. Zero address disables multi-currency.
    IMentoBroker public immutable broker;

    /// @notice Address of the agent operator authorized to release/reject.
    address public agentOperator;

    /// @notice Verification fee (in cUSD) charged per warrant, settled to the
    ///         operator on release/reject or refunded to the sender on refund.
    uint256 public verificationFee;

    /// @notice Slippage tolerance (basis points) applied to Mento payout swaps.
    uint256 public swapSlippageBps;

    uint256 private _warrantIdCounter;

    mapping(uint256 => Warrant) public warrants;
    mapping(uint256 => uint256) public warrantFeeBalance;

    mapping(address => uint256[]) private _sentWarrants;
    mapping(address => uint256[]) private _receivedWarrants;

    event FeeToppedUp(uint256 indexed warrantId, address indexed payer, uint256 amount);
    event AgentOperatorChanged(address indexed previousOperator, address indexed newOperator);
    event VerificationFeeChanged(uint256 previousFee, uint256 newFee);
    event SwapSlippageChanged(uint256 previousBps, uint256 newBps);
    event PayoutSwapped(uint256 indexed warrantId, address indexed payoutToken, uint256 amountOut);
    event PayoutFallback(uint256 indexed warrantId, address indexed receiver);

    error ZeroAmount();
    error InvalidExpiry();
    error WarrantNotFound();
    error WarrantNotOpen();
    error WarrantExpired();
    error NotReceiver();
    error InvalidProofHash();
    error WarrantNotClaimed();
    error NotAuthorizedAgent();
    error NotSender();
    error NotExpired();
    error AlreadyFinalized();
    error ZeroAddress();
    error NotSelf();
    error RouteNotFound();

    modifier onlyAgent() {
        if (
            msg.sender != agentOperator &&
            !(address(agentRegistry) != address(0) && agentRegistry.isAgent(msg.sender))
        ) {
            revert NotAuthorizedAgent();
        }
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != agentOperator) revert NotAuthorizedAgent();
        _;
    }

    /// @param _cUSD            Address of the cUSD ERC-20 token.
    /// @param _agentRegistry   ERC-8004 registry address (may be address(0)).
    /// @param _agentOperator   Initial agent operator authorized to verify.
    /// @param _verificationFee Per-warrant verification fee in cUSD units.
    /// @param _broker          Mento Broker for payout swaps (may be address(0)).
    constructor(
        address _cUSD,
        address _agentRegistry,
        address _agentOperator,
        uint256 _verificationFee,
        address _broker
    ) {
        if (_cUSD == address(0) || _agentOperator == address(0)) revert ZeroAddress();
        cUSD = IERC20(_cUSD);
        agentRegistry = IERC8004Registry(_agentRegistry);
        agentOperator = _agentOperator;
        verificationFee = _verificationFee;
        broker = IMentoBroker(_broker);
        swapSlippageBps = 200; // 2%
    }

    /// @notice Transfer operator rights to a new address.
    function setAgentOperator(address _newOperator) external onlyOperator {
        if (_newOperator == address(0)) revert ZeroAddress();
        emit AgentOperatorChanged(agentOperator, _newOperator);
        agentOperator = _newOperator;
    }

    /// @notice Update the per-warrant verification fee for new warrants.
    function setVerificationFee(uint256 _newFee) external onlyOperator {
        emit VerificationFeeChanged(verificationFee, _newFee);
        verificationFee = _newFee;
    }

    /// @notice Update the slippage tolerance (bps) for Mento payout swaps.
    function setSwapSlippageBps(uint256 _bps) external onlyOperator {
        require(_bps <= 1000, "slippage too high");
        emit SwapSlippageChanged(swapSlippageBps, _bps);
        swapSlippageBps = _bps;
    }

    /// @inheritdoc IWarrantAgent
    /// @dev Pulls `amount + verificationFee` cUSD from the sender into escrow.
    function createWarrant(
        address receiver,
        uint256 amount,
        ConditionType conditionType,
        string calldata ruleURI,
        uint256 expiresAt,
        PayoutConfig calldata payout
    ) external override nonReentrant returns (uint256) {
        if (amount == 0) revert ZeroAmount();
        if (expiresAt <= block.timestamp) revert InvalidExpiry();

        uint256 warrantId = ++_warrantIdCounter;
        uint256 fee = verificationFee;

        // Default the payout token to cUSD when unset (no swap on release).
        address payoutToken = payout.token == address(0) ? address(cUSD) : payout.token;

        warrants[warrantId] = Warrant({
            sender: msg.sender,
            receiver: receiver,
            amount: amount,
            conditionType: conditionType,
            ruleHash: keccak256(abi.encodePacked(ruleURI)),
            ruleURI: ruleURI,
            status: WarrantStatus.OPEN,
            expiresAt: expiresAt,
            proofHash: bytes32(0),
            proofURI: "",
            agentAddress: agentOperator,
            payoutToken: payoutToken,
            exchangeProvider: payout.exchangeProvider,
            exchangeId: payout.exchangeId
        });

        warrantFeeBalance[warrantId] = fee;

        _sentWarrants[msg.sender].push(warrantId);
        if (receiver != address(0)) {
            _receivedWarrants[receiver].push(warrantId);
        }

        emit WarrantCreated(warrantId, msg.sender, receiver, amount, conditionType);

        cUSD.safeTransferFrom(msg.sender, address(this), amount + fee);
        return warrantId;
    }

    /// @inheritdoc IWarrantAgent
    /// @dev If the warrant has no fixed receiver (phone-mapped via MiniPay), the
    ///      first submitter becomes the receiver.
    function submitProof(
        uint256 warrantId,
        bytes32 proofHash,
        string calldata proofURI
    ) external override {
        Warrant storage warrant = warrants[warrantId];
        if (warrant.sender == address(0)) revert WarrantNotFound();
        if (warrant.status != WarrantStatus.OPEN) revert WarrantNotOpen();
        if (block.timestamp >= warrant.expiresAt) revert WarrantExpired();
        if (proofHash == bytes32(0)) revert InvalidProofHash();

        if (warrant.receiver != address(0)) {
            if (msg.sender != warrant.receiver) revert NotReceiver();
        } else {
            warrant.receiver = msg.sender;
            _receivedWarrants[msg.sender].push(warrantId);
        }

        warrant.proofHash = proofHash;
        warrant.proofURI = proofURI;
        warrant.status = WarrantStatus.CLAIMED;

        emit ProofSubmitted(warrantId, msg.sender, proofHash, proofURI);
    }

    /// @inheritdoc IWarrantAgent
    /// @dev Only callable by the agent operator (or a registry-attested agent)
    ///      on a CLAIMED warrant. Settles the fee to the operator and releases
    ///      the escrowed amount to the receiver.
    function agentRelease(uint256 warrantId) external override onlyAgent nonReentrant {
        Warrant storage warrant = warrants[warrantId];
        if (warrant.status != WarrantStatus.CLAIMED) revert WarrantNotClaimed();

        warrant.status = WarrantStatus.RELEASED;

        uint256 fee = warrantFeeBalance[warrantId];
        warrantFeeBalance[warrantId] = 0;

        address receiver = warrant.receiver;
        uint256 amount = warrant.amount;
        address payoutToken = warrant.payoutToken;

        emit WarrantReleased(warrantId, receiver, amount);

        if (fee > 0) {
            cUSD.safeTransfer(agentOperator, fee);
        }

        if (payoutToken == address(cUSD) || address(broker) == address(0)) {
            cUSD.safeTransfer(receiver, amount);
        } else {
            // Swap cUSD into the receiver's local stable. If the swap reverts
            // (circuit breaker, slippage, missing liquidity) fall back to cUSD
            // so a release never gets stuck.
            try this.executeSwap(payoutToken, warrant.exchangeProvider, warrant.exchangeId, amount, receiver)
                returns (uint256 amountOut)
            {
                emit PayoutSwapped(warrantId, payoutToken, amountOut);
            } catch {
                cUSD.safeTransfer(receiver, amount);
                emit PayoutFallback(warrantId, receiver);
            }
        }
    }

    /// @notice Internal swap step invoked via an external self-call so it can be
    ///         wrapped in try/catch and rolled back atomically on failure.
    function executeSwap(
        address tokenOut,
        address exchangeProvider,
        bytes32 exchangeId,
        uint256 amountIn,
        address receiver
    ) external returns (uint256 amountOut) {
        if (msg.sender != address(this)) revert NotSelf();

        uint256 expected =
            broker.getAmountOut(exchangeProvider, exchangeId, address(cUSD), tokenOut, amountIn);
        uint256 minOut = (expected * (10_000 - swapSlippageBps)) / 10_000;

        cUSD.forceApprove(address(broker), amountIn);
        amountOut =
            broker.swapIn(exchangeProvider, exchangeId, address(cUSD), tokenOut, amountIn, minOut);

        IERC20(tokenOut).safeTransfer(receiver, amountOut);
    }

    /// @notice Discover the Mento (exchangeProvider, exchangeId) route for a
    ///         cUSD <-> tokenOut pair. Off-chain `eth_call` only — too gas-heavy
    ///         to run in the release path, so the route is precomputed here and
    ///         stored on the warrant at creation.
    function findMentoRoute(address tokenOut)
        external
        view
        returns (address exchangeProvider, bytes32 exchangeId)
    {
        if (address(broker) == address(0)) revert RouteNotFound();
        address cusd = address(cUSD);
        address[] memory providers = broker.getExchangeProviders();
        for (uint256 i; i < providers.length; i++) {
            IMentoExchangeProvider.Exchange[] memory exchanges =
                IMentoExchangeProvider(providers[i]).getExchanges();
            for (uint256 j; j < exchanges.length; j++) {
                address[] memory assets = exchanges[j].assets;
                if (assets.length < 2) continue;
                bool hasCusd = assets[0] == cusd || assets[1] == cusd;
                bool hasTarget = assets[0] == tokenOut || assets[1] == tokenOut;
                if (hasCusd && hasTarget) {
                    return (providers[i], exchanges[j].exchangeId);
                }
            }
        }
        revert RouteNotFound();
    }

    /// @inheritdoc IWarrantAgent
    /// @dev Resets a CLAIMED warrant back to OPEN so the receiver can resubmit.
    ///      The verification fee is settled to the operator for work performed.
    function agentReject(uint256 warrantId, string calldata reason)
        external
        override
        onlyAgent
        nonReentrant
    {
        Warrant storage warrant = warrants[warrantId];
        if (warrant.status != WarrantStatus.CLAIMED) revert WarrantNotClaimed();

        warrant.status = WarrantStatus.OPEN;
        warrant.proofHash = bytes32(0);
        warrant.proofURI = "";

        uint256 fee = warrantFeeBalance[warrantId];
        warrantFeeBalance[warrantId] = 0;

        emit WarrantRejected(warrantId, reason);

        if (fee > 0) {
            cUSD.safeTransfer(agentOperator, fee);
        }
    }

    /// @notice Add more verification fee budget to an open warrant.
    function topUpVerificationFee(uint256 warrantId, uint256 feeAmount)
        external
        nonReentrant
    {
        Warrant storage warrant = warrants[warrantId];
        if (warrant.sender == address(0)) revert WarrantNotFound();
        if (warrant.status != WarrantStatus.OPEN) revert WarrantNotOpen();
        if (feeAmount == 0) revert ZeroAmount();

        warrantFeeBalance[warrantId] += feeAmount;

        emit FeeToppedUp(warrantId, msg.sender, feeAmount);

        cUSD.safeTransferFrom(msg.sender, address(this), feeAmount);
    }

    /// @inheritdoc IWarrantAgent
    /// @dev Callable by the sender after expiry on an OPEN or CLAIMED warrant.
    ///      Returns escrow plus any remaining fee balance.
    function refund(uint256 warrantId) external override nonReentrant {
        Warrant storage warrant = warrants[warrantId];
        if (warrant.sender == address(0)) revert WarrantNotFound();
        if (
            warrant.status != WarrantStatus.OPEN &&
            warrant.status != WarrantStatus.CLAIMED
        ) revert AlreadyFinalized();
        if (block.timestamp < warrant.expiresAt) revert NotExpired();
        if (msg.sender != warrant.sender) revert NotSender();

        warrant.status = WarrantStatus.REFUNDED;

        uint256 escrowAmount = warrant.amount;
        uint256 feeAmount = warrantFeeBalance[warrantId];
        warrantFeeBalance[warrantId] = 0;

        emit WarrantRefunded(warrantId, warrant.sender, escrowAmount);

        cUSD.safeTransfer(warrant.sender, escrowAmount + feeAmount);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function getWarrant(uint256 warrantId) external view returns (Warrant memory) {
        return warrants[warrantId];
    }

    function getSentWarrants(address sender) external view returns (uint256[] memory) {
        return _sentWarrants[sender];
    }

    function getReceivedWarrants(address receiver) external view returns (uint256[] memory) {
        return _receivedWarrants[receiver];
    }

    function getWarrantCount() external view returns (uint256) {
        return _warrantIdCounter;
    }
}
