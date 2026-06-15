// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {WarrantAgent} from "../src/WarrantAgent.sol";
import {IWarrantAgent} from "../src/interfaces/IWarrantAgent.sol";
import {MockcUSD} from "../src/mocks/MockcUSD.sol";
import {MockERC8004Registry} from "../src/mocks/MockERC8004Registry.sol";
import {MockBroker} from "../src/mocks/MockBroker.sol";

contract WarrantAgentTest is Test {
    WarrantAgent public warrantAgent;
    WarrantAgent public swapAgent;
    MockcUSD public cUSD;
    MockcUSD public localStable;
    MockERC8004Registry public registry;
    MockBroker public broker;

    address public owner = address(1);
    address public sender = address(2);
    address public receiver = address(3);
    address public operator = address(4);
    address public registryAgent = address(5);
    address public stranger = address(6);

    uint256 public constant FEE = 1e16; // 0.01 cUSD
    uint256 public constant AMOUNT = 100 ether;
    uint256 public constant RATE = 130 ether; // 1 cUSD -> 130 local stable

    function setUp() public {
        vm.startPrank(owner);
        cUSD = new MockcUSD();
        localStable = new MockcUSD();
        registry = new MockERC8004Registry();
        broker = new MockBroker(address(cUSD), address(localStable), RATE);
        warrantAgent = new WarrantAgent(address(cUSD), address(registry), operator, FEE, address(0));
        swapAgent = new WarrantAgent(address(cUSD), address(registry), operator, FEE, address(broker));
        registry.setAgent(registryAgent, true);
        vm.stopPrank();

        cUSD.mint(sender, 1_000 ether);
        vm.startPrank(sender);
        cUSD.approve(address(warrantAgent), type(uint256).max);
        cUSD.approve(address(swapAgent), type(uint256).max);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    function _cusdPayout() internal pure returns (IWarrantAgent.PayoutConfig memory) {
        return IWarrantAgent.PayoutConfig(address(0), address(0), bytes32(0));
    }

    function _create(address to, IWarrantAgent.ConditionType ct) internal returns (uint256) {
        vm.prank(sender);
        return warrantAgent.createWarrant(to, AMOUNT, ct, "ipfs://rule", block.timestamp + 1 days, _cusdPayout());
    }

    function _createAndClaim(address to) internal returns (uint256 id) {
        id = _create(to, IWarrantAgent.ConditionType.RECEIPT);
        vm.prank(to);
        warrantAgent.submitProof(id, keccak256("proof"), "ipfs://proof");
    }

    // ------------------------------------------------------------------
    // createWarrant
    // ------------------------------------------------------------------

    function testCreateWarrant() public {
        uint256 id = _create(receiver, IWarrantAgent.ConditionType.RECEIPT);
        assertEq(id, 1);

        WarrantAgent.Warrant memory w = warrantAgent.getWarrant(id);
        assertEq(w.sender, sender);
        assertEq(w.receiver, receiver);
        assertEq(w.amount, AMOUNT);
        assertEq(uint8(w.conditionType), uint8(IWarrantAgent.ConditionType.RECEIPT));
        assertEq(w.ruleURI, "ipfs://rule");
        assertEq(uint8(w.status), uint8(IWarrantAgent.WarrantStatus.OPEN));
        assertEq(w.agentAddress, operator);
        assertEq(warrantAgent.warrantFeeBalance(id), FEE);
    }

    function testCreatePullsAmountPlusFee() public {
        uint256 before = cUSD.balanceOf(sender);
        _create(receiver, IWarrantAgent.ConditionType.MANUAL);
        assertEq(cUSD.balanceOf(sender), before - AMOUNT - FEE);
        assertEq(cUSD.balanceOf(address(warrantAgent)), AMOUNT + FEE);
    }

    function testCreateZeroAmountReverts() public {
        vm.prank(sender);
        vm.expectRevert(WarrantAgent.ZeroAmount.selector);
        warrantAgent.createWarrant(receiver, 0, IWarrantAgent.ConditionType.RECEIPT, "r", block.timestamp + 1 days, _cusdPayout());
    }

    function testCreatePastExpiryReverts() public {
        vm.prank(sender);
        vm.expectRevert(WarrantAgent.InvalidExpiry.selector);
        warrantAgent.createWarrant(receiver, AMOUNT, IWarrantAgent.ConditionType.RECEIPT, "r", block.timestamp, _cusdPayout());
    }

    function testCreateTracksSentAndReceived() public {
        uint256 id = _create(receiver, IWarrantAgent.ConditionType.RECEIPT);
        uint256[] memory sent = warrantAgent.getSentWarrants(sender);
        uint256[] memory recv = warrantAgent.getReceivedWarrants(receiver);
        assertEq(sent.length, 1);
        assertEq(sent[0], id);
        assertEq(recv.length, 1);
        assertEq(recv[0], id);
        assertEq(warrantAgent.getWarrantCount(), 1);
    }

    // ------------------------------------------------------------------
    // submitProof
    // ------------------------------------------------------------------

    function testSubmitProof() public {
        uint256 id = _create(receiver, IWarrantAgent.ConditionType.RECEIPT);
        vm.prank(receiver);
        warrantAgent.submitProof(id, keccak256("proof"), "ipfs://proof");

        WarrantAgent.Warrant memory w = warrantAgent.getWarrant(id);
        assertEq(uint8(w.status), uint8(IWarrantAgent.WarrantStatus.CLAIMED));
        assertEq(w.proofHash, keccak256("proof"));
        assertEq(w.proofURI, "ipfs://proof");
    }

    function testSubmitProofOpenClaimAssignsReceiver() public {
        uint256 id = _create(address(0), IWarrantAgent.ConditionType.RECEIPT);
        vm.prank(receiver);
        warrantAgent.submitProof(id, keccak256("proof"), "ipfs://proof");

        WarrantAgent.Warrant memory w = warrantAgent.getWarrant(id);
        assertEq(w.receiver, receiver);
        assertEq(uint8(w.status), uint8(IWarrantAgent.WarrantStatus.CLAIMED));
        uint256[] memory recv = warrantAgent.getReceivedWarrants(receiver);
        assertEq(recv.length, 1);
    }

    function testSubmitProofWrongReceiverReverts() public {
        uint256 id = _create(receiver, IWarrantAgent.ConditionType.RECEIPT);
        vm.prank(stranger);
        vm.expectRevert(WarrantAgent.NotReceiver.selector);
        warrantAgent.submitProof(id, keccak256("proof"), "ipfs://proof");
    }

    function testSubmitProofZeroHashReverts() public {
        uint256 id = _create(receiver, IWarrantAgent.ConditionType.RECEIPT);
        vm.prank(receiver);
        vm.expectRevert(WarrantAgent.InvalidProofHash.selector);
        warrantAgent.submitProof(id, bytes32(0), "ipfs://proof");
    }

    function testSubmitProofExpiredReverts() public {
        uint256 id = _create(receiver, IWarrantAgent.ConditionType.RECEIPT);
        vm.warp(block.timestamp + 2 days);
        vm.prank(receiver);
        vm.expectRevert(WarrantAgent.WarrantExpired.selector);
        warrantAgent.submitProof(id, keccak256("proof"), "ipfs://proof");
    }

    function testSubmitProofNotOpenReverts() public {
        uint256 id = _createAndClaim(receiver);
        vm.prank(receiver);
        vm.expectRevert(WarrantAgent.WarrantNotOpen.selector);
        warrantAgent.submitProof(id, keccak256("proof2"), "ipfs://proof2");
    }

    function testSubmitProofNonexistentReverts() public {
        vm.prank(receiver);
        vm.expectRevert(WarrantAgent.WarrantNotFound.selector);
        warrantAgent.submitProof(999, keccak256("proof"), "ipfs://proof");
    }

    // ------------------------------------------------------------------
    // agentRelease
    // ------------------------------------------------------------------

    function testAgentRelease() public {
        uint256 id = _createAndClaim(receiver);
        uint256 recvBefore = cUSD.balanceOf(receiver);
        uint256 opBefore = cUSD.balanceOf(operator);

        vm.prank(operator);
        warrantAgent.agentRelease(id);

        assertEq(cUSD.balanceOf(receiver), recvBefore + AMOUNT);
        assertEq(cUSD.balanceOf(operator), opBefore + FEE);
        assertEq(warrantAgent.warrantFeeBalance(id), 0);
        assertEq(uint8(warrantAgent.getWarrant(id).status), uint8(IWarrantAgent.WarrantStatus.RELEASED));
    }

    function testAgentReleaseByRegistryAgent() public {
        uint256 id = _createAndClaim(receiver);
        uint256 opBefore = cUSD.balanceOf(operator);

        // A registry-attested agent (not the operator) can also release.
        vm.prank(registryAgent);
        warrantAgent.agentRelease(id);

        // Fee still settles to the operator.
        assertEq(cUSD.balanceOf(operator), opBefore + FEE);
        assertEq(cUSD.balanceOf(receiver), AMOUNT);
    }

    function testAgentReleaseUnauthorizedReverts() public {
        uint256 id = _createAndClaim(receiver);
        vm.prank(stranger);
        vm.expectRevert(WarrantAgent.NotAuthorizedAgent.selector);
        warrantAgent.agentRelease(id);
    }

    function testAgentReleaseNotClaimedReverts() public {
        uint256 id = _create(receiver, IWarrantAgent.ConditionType.RECEIPT);
        vm.prank(operator);
        vm.expectRevert(WarrantAgent.WarrantNotClaimed.selector);
        warrantAgent.agentRelease(id);
    }

    function testAgentReleaseTwiceReverts() public {
        uint256 id = _createAndClaim(receiver);
        vm.startPrank(operator);
        warrantAgent.agentRelease(id);
        vm.expectRevert(WarrantAgent.WarrantNotClaimed.selector);
        warrantAgent.agentRelease(id);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------
    // agentReject
    // ------------------------------------------------------------------

    function testAgentReject() public {
        uint256 id = _createAndClaim(receiver);
        uint256 opBefore = cUSD.balanceOf(operator);

        vm.prank(operator);
        warrantAgent.agentReject(id, "invalid merchant");

        assertEq(cUSD.balanceOf(operator), opBefore + FEE);
        assertEq(warrantAgent.warrantFeeBalance(id), 0);
        WarrantAgent.Warrant memory w = warrantAgent.getWarrant(id);
        assertEq(uint8(w.status), uint8(IWarrantAgent.WarrantStatus.OPEN));
        assertEq(w.proofHash, bytes32(0));
        assertEq(w.proofURI, "");
    }

    function testRejectThenResubmitThenRelease() public {
        uint256 id = _createAndClaim(receiver);
        vm.prank(operator);
        warrantAgent.agentReject(id, "retry");

        // Resubmit on the reopened warrant.
        vm.prank(receiver);
        warrantAgent.submitProof(id, keccak256("proof2"), "ipfs://proof2");

        uint256 recvBefore = cUSD.balanceOf(receiver);
        uint256 opBefore = cUSD.balanceOf(operator);
        vm.prank(operator);
        warrantAgent.agentRelease(id);

        // Fee was already paid out on reject, so no further fee on release.
        assertEq(cUSD.balanceOf(receiver), recvBefore + AMOUNT);
        assertEq(cUSD.balanceOf(operator), opBefore);
    }

    function testAgentRejectUnauthorizedReverts() public {
        uint256 id = _createAndClaim(receiver);
        vm.prank(stranger);
        vm.expectRevert(WarrantAgent.NotAuthorizedAgent.selector);
        warrantAgent.agentReject(id, "nope");
    }

    // ------------------------------------------------------------------
    // refund
    // ------------------------------------------------------------------

    function testRefundBeforeExpiryReverts() public {
        uint256 id = _create(receiver, IWarrantAgent.ConditionType.RECEIPT);
        vm.prank(sender);
        vm.expectRevert(WarrantAgent.NotExpired.selector);
        warrantAgent.refund(id);
    }

    function testRefundAfterExpiry() public {
        uint256 id = _create(receiver, IWarrantAgent.ConditionType.RECEIPT);
        vm.warp(block.timestamp + 2 days);

        uint256 before = cUSD.balanceOf(sender);
        vm.prank(sender);
        warrantAgent.refund(id);

        assertEq(cUSD.balanceOf(sender), before + AMOUNT + FEE);
        assertEq(uint8(warrantAgent.getWarrant(id).status), uint8(IWarrantAgent.WarrantStatus.REFUNDED));
    }

    function testRefundClaimedAfterExpiry() public {
        uint256 id = _createAndClaim(receiver);
        vm.warp(block.timestamp + 2 days);
        uint256 before = cUSD.balanceOf(sender);
        vm.prank(sender);
        warrantAgent.refund(id);
        assertEq(cUSD.balanceOf(sender), before + AMOUNT + FEE);
    }

    function testRefundOnlySenderReverts() public {
        uint256 id = _create(receiver, IWarrantAgent.ConditionType.RECEIPT);
        vm.warp(block.timestamp + 2 days);
        vm.prank(stranger);
        vm.expectRevert(WarrantAgent.NotSender.selector);
        warrantAgent.refund(id);
    }

    function testRefundReleasedReverts() public {
        uint256 id = _createAndClaim(receiver);
        vm.prank(operator);
        warrantAgent.agentRelease(id);
        vm.warp(block.timestamp + 2 days);
        vm.prank(sender);
        vm.expectRevert(WarrantAgent.AlreadyFinalized.selector);
        warrantAgent.refund(id);
    }

    // ------------------------------------------------------------------
    // topUpVerificationFee
    // ------------------------------------------------------------------

    function testTopUpVerificationFee() public {
        uint256 id = _create(receiver, IWarrantAgent.ConditionType.RECEIPT);
        vm.prank(sender);
        warrantAgent.topUpVerificationFee(id, FEE);
        assertEq(warrantAgent.warrantFeeBalance(id), FEE * 2);
    }

    function testTopUpNotOpenReverts() public {
        uint256 id = _createAndClaim(receiver);
        vm.prank(sender);
        vm.expectRevert(WarrantAgent.WarrantNotOpen.selector);
        warrantAgent.topUpVerificationFee(id, FEE);
    }

    // ------------------------------------------------------------------
    // admin
    // ------------------------------------------------------------------

    function testSetAgentOperator() public {
        vm.prank(operator);
        warrantAgent.setAgentOperator(stranger);
        assertEq(warrantAgent.agentOperator(), stranger);
    }

    function testSetAgentOperatorUnauthorizedReverts() public {
        vm.prank(stranger);
        vm.expectRevert(WarrantAgent.NotAuthorizedAgent.selector);
        warrantAgent.setAgentOperator(stranger);
    }

    function testSetVerificationFee() public {
        vm.prank(operator);
        warrantAgent.setVerificationFee(5e16);
        assertEq(warrantAgent.verificationFee(), 5e16);
    }

    function testConstructorZeroAddressReverts() public {
        vm.expectRevert(WarrantAgent.ZeroAddress.selector);
        new WarrantAgent(address(0), address(registry), operator, FEE, address(0));
        vm.expectRevert(WarrantAgent.ZeroAddress.selector);
        new WarrantAgent(address(cUSD), address(registry), address(0), FEE, address(0));
    }

    // ------------------------------------------------------------------
    // fuzz
    // ------------------------------------------------------------------

    function testFuzzCreateAndRelease(uint96 amount) public {
        amount = uint96(bound(amount, 1, 500 ether));
        cUSD.mint(sender, amount + FEE);

        vm.prank(sender);
        uint256 id = warrantAgent.createWarrant(
            receiver, amount, IWarrantAgent.ConditionType.MANUAL, "r", block.timestamp + 1 days, _cusdPayout()
        );
        vm.prank(receiver);
        warrantAgent.submitProof(id, keccak256("p"), "ipfs://p");

        uint256 recvBefore = cUSD.balanceOf(receiver);
        vm.prank(operator);
        warrantAgent.agentRelease(id);
        assertEq(cUSD.balanceOf(receiver), recvBefore + amount);
    }

    // ------------------------------------------------------------------
    // Mento multi-currency payout
    // ------------------------------------------------------------------

    function _swapPayout() internal view returns (IWarrantAgent.PayoutConfig memory) {
        return IWarrantAgent.PayoutConfig(address(localStable), address(broker), broker.EXCHANGE_ID());
    }

    function _createSwap(address to) internal returns (uint256) {
        // Build the payout config (reads broker.EXCHANGE_ID()) BEFORE pranking,
        // otherwise the read consumes the prank and createWarrant runs as `this`.
        IWarrantAgent.PayoutConfig memory payout = _swapPayout();
        vm.prank(sender);
        return swapAgent.createWarrant(to, AMOUNT, IWarrantAgent.ConditionType.MANUAL, "r", block.timestamp + 1 days, payout);
    }

    function testFindMentoRoute() public view {
        (address provider, bytes32 exId) = swapAgent.findMentoRoute(address(localStable));
        assertEq(provider, address(broker));
        assertEq(exId, broker.EXCHANGE_ID());
    }

    function testReleaseSwapsToPayoutToken() public {
        uint256 id = _createSwap(receiver);
        vm.prank(receiver);
        swapAgent.submitProof(id, keccak256("p"), "ipfs://p");

        uint256 opBefore = cUSD.balanceOf(operator);
        vm.prank(operator);
        swapAgent.agentRelease(id);

        // Receiver gets the local stable at the broker rate; no leftover cUSD.
        assertEq(localStable.balanceOf(receiver), (AMOUNT * RATE) / 1e18);
        assertEq(cUSD.balanceOf(receiver), 0);
        // Fee still settles to the operator in cUSD.
        assertEq(cUSD.balanceOf(operator), opBefore + FEE);
        assertEq(uint8(swapAgent.getWarrant(id).status), uint8(IWarrantAgent.WarrantStatus.RELEASED));
    }

    function testReleaseFallsBackToCusdOnSwapFailure() public {
        broker.setShouldRevert(true);
        uint256 id = _createSwap(receiver);
        vm.prank(receiver);
        swapAgent.submitProof(id, keccak256("p"), "ipfs://p");

        uint256 recvBefore = cUSD.balanceOf(receiver);
        vm.prank(operator);
        swapAgent.agentRelease(id);

        // Swap reverted -> receiver gets cUSD instead, release still succeeds.
        assertEq(cUSD.balanceOf(receiver), recvBefore + AMOUNT);
        assertEq(localStable.balanceOf(receiver), 0);
        assertEq(uint8(swapAgent.getWarrant(id).status), uint8(IWarrantAgent.WarrantStatus.RELEASED));
    }

    function testExecuteSwapNotSelfReverts() public {
        bytes32 exId = broker.EXCHANGE_ID();
        vm.prank(stranger);
        vm.expectRevert(WarrantAgent.NotSelf.selector);
        swapAgent.executeSwap(address(localStable), address(broker), exId, AMOUNT, receiver);
    }

    function testSetSwapSlippage() public {
        vm.prank(operator);
        swapAgent.setSwapSlippageBps(300);
        assertEq(swapAgent.swapSlippageBps(), 300);
    }
}
