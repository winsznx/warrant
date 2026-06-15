// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {WarrantAgent} from "../src/WarrantAgent.sol";

/// @notice Production deploy for Celo (mainnet or Alfajores). The cUSD and
///         ERC-8004 registry addresses come from the environment so the same
///         script targets any network. The registry is optional — when omitted,
///         only the operator key can release/reject.
///
/// Required env:
///   DEPLOYER_PRIVATE_KEY  - deployer/operator key (uint)
///   CUSD_ADDRESS          - cUSD token address for the target network
/// Optional env:
///   REGISTRY_ADDRESS      - ERC-8004 registry (default: address(0))
///   AGENT_OPERATOR        - operator address (default: deployer)
///   VERIFICATION_FEE      - per-warrant fee in cUSD units (default: 0.01 cUSD)
///   BROKER_ADDRESS        - Mento Broker for payout swaps (default: address(0))
///                           mainnet 0x777A8255cA72412f0d706dc03C9D1987306B4CaD
///                           alfajores 0xD3Dff18E465bCa6241A244144765b4421Ac14D09
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address cusd = vm.envAddress("CUSD_ADDRESS");
        address registry = vm.envOr("REGISTRY_ADDRESS", address(0));
        address operator = vm.envOr("AGENT_OPERATOR", vm.addr(deployerKey));
        uint256 fee = vm.envOr("VERIFICATION_FEE", uint256(1e16));
        address mentoBroker = vm.envOr("BROKER_ADDRESS", address(0));

        vm.startBroadcast(deployerKey);
        WarrantAgent warrant = new WarrantAgent(cusd, registry, operator, fee, mentoBroker);
        vm.stopBroadcast();

        console.log("WarrantAgent deployed:", address(warrant));
        console.log("cUSD:                 ", cusd);
        console.log("Registry:             ", registry);
        console.log("Operator:             ", operator);
        console.log("VerificationFee:      ", fee);
        console.log("MentoBroker:          ", mentoBroker);
    }
}
