pragma solidity 0.4.25;

import "./ContinuousToken.sol";
import "../interfaces/ICERC20.sol";

contract ContinuousTokenWithLending is ContinuousToken {
    using SafeMath for uint;

    ERC20 public reserveToken;
    ICERC20 public cReserveToken;
    bool public activated;
    uint public totalDepositedReserve;

    constructor(
        string _name,
        string _symbol,
        uint8 _decimals,
        uint _initialSupply,
        uint _initialReserve,
        uint32 _reserveRatio,
        address _reserveTokenAddress,
        address _cReserveTokenAddress
    ) public ContinuousToken(_name, _symbol, _decimals, _initialSupply, _reserveRatio) {
        reserveToken = ERC20(_reserveTokenAddress);
        cReserveToken = ICERC20(_cReserveTokenAddress);
        totalDepositedReserve = _initialReserve;
    }

    function () public { revert("Cannot call fallback function."); }

    // Must be called after contract creationt for bonded token to become operational
    function activate(address _treasury) public onlyOwner {
        if (_treasury != address(0)) {
            transferOwnership(_treasury);
        }
        require(reserveToken.transferFrom(msg.sender, address(this), totalDepositedReserve), "activate() ERC20.transferFrom failed.");
        require(reserveToken.approve(address(cReserveToken), totalDepositedReserve), "activate() ERC20.approve failed.");
        require(cReserveToken.mint(totalDepositedReserve) == 0, "activate() cERC20.mint failed.");
        activated = true;
    }

    function mint(uint _amount, uint _minReceived) public {
        require(activated);
        _continuousMint(_amount, _minReceived);
        require(reserveToken.transferFrom(msg.sender, address(this), _amount), "mint() ERC20.transferFrom failed.");
        require(reserveToken.approve(address(cReserveToken), _amount), "mint() ERC20.approve failed.");
        require(cReserveToken.mint(_amount) == 0, "mint() cERC20.mint failed.");
        totalDepositedReserve = totalDepositedReserve.add(_amount);
    }

    function burn(uint _amount, uint _minReceived) public {
        require(activated);
        uint returnAmount = _continuousBurn(_amount, _minReceived);
        require(cReserveToken.redeemUnderlying(returnAmount) == 0, "burn() cERC20.redeemUnderlying failed.");
        require(reserveToken.transfer(msg.sender, returnAmount), "burn() ERC20.transfer failed.");
        totalDepositedReserve = totalDepositedReserve.sub(returnAmount);
    }

    function withdrawInterest(uint _amount) public onlyOwner {
        require(reserveInterest() >= _amount, "withdrawInterest() amount exceeds interest accrued");
        require(cReserveToken.redeemUnderlying(_amount) == 0, "withdrawInterest() cERC20.redeemUnderlying failed.");
        require(reserveToken.transfer(msg.sender, _amount), "withdrawInterest() ERC20.transfer failed.");
    }

    function reserveBalance() public view returns (uint) {
        return totalDepositedReserve;
    }

    function reserveInterest() public view returns (uint) {
        return cReserveToken.balanceOfUnderlying(address(this)).sub(totalDepositedReserve);
    }

    function treasuryAddress() public view returns (address) {
        return owner();
    }
}