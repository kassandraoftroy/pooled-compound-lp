pragma solidity 0.4.25;

/**
 * @title ERC20 interface
 * @dev see https://github.com/ethereum/EIPs/issues/20
 */
interface ICERC20 {
    function mint(uint mintAmount) returns (uint);
    function redeem(uint redeemTokens) returns (uint);
    function redeemUnderlying(uint redeemAmount) returns (uint);
    function borrow(uint borrowAmount) returns (uint);
    function repayBorrow(uint repayAmount) returns (uint);
    function balanceOfUnderlying(address account) view returns (uint);
    function exchangeRateCurrent() view returns (uint);
}