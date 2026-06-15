// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC8004Registry {
    event AgentRegistered(uint256 indexed agentId, address indexed operator, string metadataURI);
    event CapabilityRegistered(uint256 indexed agentId, string capability);

    function registerAgent(string calldata metadataURI) external returns (uint256);
    function registerCapability(uint256 agentId, string calldata capability) external;
    
    function isAgent(address agentAddress) external view returns (bool);
    function hasCapability(address agentAddress, string calldata capability) external view returns (bool);
    function getAgentOperator(address agentAddress) external view returns (address);
}
