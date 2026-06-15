// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IMentoBroker, IMentoExchangeProvider} from "../interfaces/IMentoBroker.sol";
import {MockcUSD} from "./MockcUSD.sol";

/// @notice Mock Mento Broker for tests: swaps tokenA->tokenB at a fixed rate by
///         pulling tokenIn and minting tokenOut. `setShouldRevert` simulates a
///         tripped circuit breaker so the release fallback path can be tested.
contract MockBroker is IMentoBroker, IMentoExchangeProvider {
    bytes32 public constant EXCHANGE_ID = keccak256("mock-cusd-local");

    address public immutable tokenA;
    address public immutable tokenB;
    uint256 public rate; // 1e18 == 1:1
    bool public shouldRevert;

    constructor(address _tokenA, address _tokenB, uint256 _rate) {
        tokenA = _tokenA;
        tokenB = _tokenB;
        rate = _rate;
    }

    function setShouldRevert(bool value) external {
        shouldRevert = value;
    }

    function getExchangeProviders() external view returns (address[] memory providers) {
        providers = new address[](1);
        providers[0] = address(this);
    }

    function getExchanges() external view returns (Exchange[] memory exchanges) {
        exchanges = new Exchange[](1);
        address[] memory assets = new address[](2);
        assets[0] = tokenA;
        assets[1] = tokenB;
        exchanges[0] = Exchange({exchangeId: EXCHANGE_ID, assets: assets});
    }

    function getAmountOut(address, bytes32, address, address, uint256 amountIn)
        external
        view
        returns (uint256)
    {
        return (amountIn * rate) / 1e18;
    }

    function swapIn(
        address,
        bytes32,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin
    ) external returns (uint256 amountOut) {
        require(!shouldRevert, "MockBroker: forced revert");
        amountOut = (amountIn * rate) / 1e18;
        require(amountOut >= amountOutMin, "MockBroker: slippage");
        require(IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn), "transferFrom failed");
        MockcUSD(tokenOut).mint(msg.sender, amountOut);
    }
}
