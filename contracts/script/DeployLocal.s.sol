// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {WarrantAgent} from "../src/WarrantAgent.sol";
import {MockcUSD} from "../src/mocks/MockcUSD.sol";
import {MockERC8004Registry} from "../src/mocks/MockERC8004Registry.sol";

/// @notice Local (anvil) deploy: spins up a mock cUSD and mock ERC-8004 registry
///         so the full flow runs end-to-end with no external dependencies, and
///         funds the deployer with mock cUSD.
contract DeployLocal is Script {
    function run() external {
        uint256 deployerKey = vm.envOr(
            "DEPLOYER_PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        uint256 fee = vm.envOr("VERIFICATION_FEE", uint256(1e16));
        address operator = vm.envOr("AGENT_OPERATOR", vm.addr(deployerKey));

        vm.startBroadcast(deployerKey);

        MockcUSD cusd = new MockcUSD();
        MockERC8004Registry registry = new MockERC8004Registry();
        // No Mento broker locally — payouts settle in cUSD.
        WarrantAgent warrant = new WarrantAgent(address(cusd), address(registry), operator, fee, address(0));

        registry.setAgent(operator, true);
        cusd.mint(vm.addr(deployerKey), 100_000 ether);

        vm.stopBroadcast();

        console.log("MockcUSD:        ", address(cusd));
        console.log("MockRegistry:    ", address(registry));
        console.log("WarrantAgent:    ", address(warrant));
        console.log("Operator:        ", operator);
        console.log("VerificationFee: ", fee);
    }
}
