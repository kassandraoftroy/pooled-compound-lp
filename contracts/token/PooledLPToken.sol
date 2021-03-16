// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.4.25;

import "./BondedGovToken.sol";
import "../interfaces/ICERC20.sol";
import "../interfaces/IWETH.sol";

contract PooledLPToken is BondedGovToken {
    using SafeMath for uint256;

    address private constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address private constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    IERC20 public reserveToken;
    ICERC20 public cReserveToken;
    bool public activated;
    uint256 public totalDepositedReserve;
    mapping(address => bool) treasurers;

    constructor(
        string _name,
        string _symbol,
        uint8 _decimals,
        uint256 _initialSupply,
        uint256 _initialReserve,
        uint32 _reserveRatio,
        address _reserveTokenAddress,
        address _cReserveTokenAddress
    ) public BondedGovToken(_name, _symbol, _decimals, _initialSupply, _reserveRatio) {
        reserveToken = IERC20(_reserveTokenAddress);
        cReserveToken = ICERC20(_cReserveTokenAddress);
        totalDepositedReserve = _initialReserve;
    }

    function () public payable {}

    // Must be called after contract creation for bonded token to become operational
    function activate(address _newOwner) public onlyOwner {
        if (_newOwner != address(0)) {
            transferOwnership(_newOwner);
        }
        require(reserveToken.transferFrom(msg.sender, address(this), totalDepositedReserve), "activate() ERC20.transferFrom failed.");
        require(reserveToken.approve(address(cReserveToken), totalDepositedReserve), "activate() ERC20.approve failed.");
        require(cReserveToken.mint(totalDepositedReserve) == 0, "activate() cERC20.mint failed.");
        activated = true;
    }

    function mint(uint256 _amount, uint256 _minReceived) public {
        require(activated);
        _continuousMint(_amount, _minReceived);
        require(reserveToken.transferFrom(msg.sender, address(this), _amount), "mint() ERC20.transferFrom failed.");
        require(reserveToken.approve(address(cReserveToken), _amount), "mint() ERC20.approve failed.");
        require(cReserveToken.mint(_amount) == 0, "mint() cERC20.mint failed.");
        totalDepositedReserve = totalDepositedReserve.add(_amount);
    }

    function burn(uint256 _amount, uint256 _minReceived) public {
        require(activated);
        uint256 returnAmount = _continuousBurn(_amount, _minReceived);
        require(cReserveToken.redeemUnderlying(returnAmount) == 0, "burn() cERC20.redeemUnderlying failed.");
        require(reserveToken.transfer(msg.sender, returnAmount), "burn() ERC20.transfer failed.");
        totalDepositedReserve = totalDepositedReserve.sub(returnAmount);
    }

    function whitelistTreasurer(address newTreasurer) public onlyOwner {
        require(!treasurers[newTreasurer], "treasurer already whitelisted");
        treasurers[newTreasurer] = true;
    }

    function blacklistTreasurer(address treasurer) public {
        require(treasurers[treasurer], "target is not a treasurer");
        require(treasurers[msg.sender] || msg.sender == owner(), "only treasurers or owner can blacklist");
        treasurers[treasurer] = false;
    }

    function withdrawInterest(uint256 _amount) public {
        require(treasurers[msg.sender] || msg.sender == owner(), "only treasurers or owner can withdraw interest");
        uint256 interest = reserveDifferential();
        require(interest >= _amount, "withdrawInterest() interest accrued is below withdraw amount");
        require(cReserveToken.redeemUnderlying(_amount) == 0, "withdrawInterest() cERC20.redeemUnderlying failed.");
        require(reserveToken.transfer(msg.sender, _amount), "withdrawInterest() ERC20.transfer failed.");
    }

    function withdrawToken(address _tokenAddress, uint256 _amount) public {
        require(treasurers[msg.sender] || msg.sender == owner(), "only treasurers or owner can withdraw tokens");
        require(_tokenAddress != address(cReserveToken), "withdrawToken() cannot withdraw collateral token.");
        if (_tokenAddress == ETH) {
            require(address(this).balance >= _amount);
            IWETH(WETH).deposit.value(_amount)();
            _tokenAddress = WETH;
        }
        require(IERC20(_tokenAddress).transfer(msg.sender, _amount), "withdrawToken() ERC20.transfer failed.");
    }

    function reserveBalance() public view returns (uint256) {
        return totalDepositedReserve;
    }

    function reserveDifferential() public view returns (uint256) {
        return cReserveToken.balanceOfUnderlying(address(this)).sub(totalDepositedReserve);
    }
}