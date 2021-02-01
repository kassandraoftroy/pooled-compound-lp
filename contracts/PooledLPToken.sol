pragma solidity 0.4.25;

import "./token/ContinuousToken.sol";
import "./interfaces/ICERC20.sol";
import "./interfaces/IWETH.sol";

contract PooledLPToken is ContinuousToken {
    using SafeMath for uint256;

    address private constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address private constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    ERC20 public reserveToken;
    ICERC20 public cReserveToken;
    bool public activated;
    uint256 public totalDepositedReserve;

    constructor(
        string _name,
        string _symbol,
        uint8 _decimals,
        uint256 _initialSupply,
        uint256 _initialReserve,
        uint32 _reserveRatio,
        address _reserveTokenAddress,
        address _cReserveTokenAddress
    ) public ContinuousToken(_name, _symbol, _decimals, _initialSupply, _reserveRatio) {
        reserveToken = ERC20(_reserveTokenAddress);
        cReserveToken = ICERC20(_cReserveTokenAddress);
        totalDepositedReserve = _initialReserve;
    }

    function () public payable {}

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

    function withdrawInterest(uint256 _amount) public onlyOwner {
        uint256 interest = reserveDifferential();
        require(interest >= _amount, "withdrawInterest() interest accrued is below withdraw amount");
        require(cReserveToken.redeemUnderlying(_amount) == 0, "withdrawInterest() cERC20.redeemUnderlying failed.");
        require(reserveToken.transfer(msg.sender, _amount), "withdrawInterest() ERC20.transfer failed.");
    }

    function withdrawToken(address _tokenAddress, uint256 _amount) public onlyOwner {
        require(_tokenAddress != address(cReserveToken), "withdrawToken() cannot withdraw collateral token.");
        if (_tokenAddress == ETH) {
            require(address(this).balance >= _amount);
            IWETH(WETH).deposit.value(_amount)();
            _tokenAddress = WETH;
        }
        require(ERC20(_tokenAddress).transfer(msg.sender, _amount), "withdrawToken() ERC20.transfer failed.");
    }

    function reserveBalance() public view returns (uint256) {
        return totalDepositedReserve;
    }

    function reserveDifferential() public view returns (uint256) {
        return cReserveToken.balanceOfUnderlying(address(this)).sub(totalDepositedReserve);
    }

    function treasuryAddress() public view returns (address) {
        return owner();
    }
}