// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal Mento Broker surface used to swap one Celo stable for another.
/// @dev Broker proxy (Celo mainnet): 0x777A8255cA72412f0d706dc03C9D1987306B4CaD
interface IMentoBroker {
    function getExchangeProviders() external view returns (address[] memory);

    function getAmountOut(
        address exchangeProvider,
        bytes32 exchangeId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut);

    function swapIn(
        address exchangeProvider,
        bytes32 exchangeId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin
    ) external returns (uint256 amountOut);
}

/// @notice Exchange-provider view used to discover the (provider, exchangeId)
///         route for a token pair.
interface IMentoExchangeProvider {
    struct Exchange {
        bytes32 exchangeId;
        address[] assets;
    }

    function getExchanges() external view returns (Exchange[] memory);
}
