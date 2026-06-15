// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC8004Registry} from "../interfaces/IERC8004.sol";

/// @notice Minimal ERC-8004 registry for local/testnet use. Production
///         deployments wire the WarrantAgent to the canonical registry instead.
contract MockERC8004Registry is IERC8004Registry {
    mapping(address => bool) public agents;
    mapping(address => mapping(string => bool)) public capabilities;
    mapping(address => address) public operators;
    uint256 private _idCounter;

    function registerAgent(string calldata metadataURI) external override returns (uint256) {
        _idCounter++;
        agents[msg.sender] = true;
        operators[msg.sender] = msg.sender;
        emit AgentRegistered(_idCounter, msg.sender, metadataURI);
        return _idCounter;
    }

    function registerCapability(uint256, string calldata capability) external override {
        capabilities[msg.sender][capability] = true;
        emit CapabilityRegistered(_idCounter, capability);
    }

    function isAgent(address agentAddress) external view override returns (bool) {
        return agents[agentAddress];
    }

    function hasCapability(address agentAddress, string calldata capability)
        external
        view
        override
        returns (bool)
    {
        return capabilities[agentAddress][capability];
    }

    function getAgentOperator(address agentAddress) external view override returns (address) {
        return operators[agentAddress];
    }

    function setAgent(address agentAddress, bool status) external {
        agents[agentAddress] = status;
    }
}
