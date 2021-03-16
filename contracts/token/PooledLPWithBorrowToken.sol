pragma solidity 0.4.25;

import "./BondedGovToken.sol";
import "../interfaces/ICERC20.sol";
import "../interfaces/ICEther.sol";
import "../interfaces/IWETH.sol";

contract PooledLPWithBorrowToken is BondedGovToken {
    using SafeMath for uint256;

    address private constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address private constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    address private constant CETH = 0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5;

    IERC20 public reserveToken;
    ICERC20 public cReserveToken;
    bool public activated;
    uint256 public totalDepositedReserve;
    mapping(address => bool) public treasurers;
    mapping(address => bool) public managers;

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

    // Must be called after contract creationt for bonded token to become operational
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
        (, bool isSolvent) = reserveDifferential();
        require(isSolvent, "burn() burn locked when insolvent.");
    }

    function whitelistTreasurer(address newTreasurer) public onlyOwner {
        require(!treasurers[newTreasurer], "treasurer already whitelisted");
        treasurers[newTreasurer] = true;
    }

    function blacklistTreasurer(address treasurer) public {
        require(treasurers[treasurer], "target is not a treasurer");
        require(managers[msg.sender] || treasurers[msg.sender] || msg.sender == owner(), "not permitted to blacklist");
        treasurers[treasurer] = false;
    }

    function whitelistManager(address newManager) public onlyOwner {
        require(!managers[newManager], "manager already whitelisted");
        managers[newManager] = true;
    }

    function blacklistManager(address manager) public {
        require(managers[manager], "target is not a manager");
        require(treasurers[msg.sender] || managers[msg.sender] || msg.sender == owner(), "not permitted to blacklist");
        treasurers[manager] = false;
    }

    function withdrawInterest(uint256 _amount) public {
        require(treasurers[msg.sender] || managers[msg.sender] || msg.sender == owner(), "not permitted to withdraw");
        require(cReserveToken.redeemUnderlying(_amount) == 0, "withdrawInterest() cERC20.redeemUnderlying failed.");
        require(reserveToken.transfer(msg.sender, _amount), "withdrawInterest() ERC20.transfer failed.");
        (, bool isSolvent) = reserveDifferential();
        require(isSolvent, "withdrawInterest() locked when insolvent.");
    }

    function withdrawToken(address _tokenAddress, uint256 _amount) public {
        require(treasurers[msg.sender] || managers[msg.sender] || msg.sender == owner(), "not permitted to withdraw");
        require(_tokenAddress != address(cReserveToken), "withdrawToken() cannot withdraw collateral token.");
        if (_tokenAddress == ETH) {
            require(address(this).balance >= _amount);
            IWETH(WETH).deposit.value(_amount)();
            _tokenAddress = WETH;
        }
        require(IERC20(_tokenAddress).transfer(msg.sender, _amount), "withdrawToken() withdraw amount is larger than token balance.");
    }

    function borrowAsset(address _cTokenAddress, uint256 _amount) public {
        require(managers[msg.sender] || msg.sender == owner(), "not permitted to borrow");
        require(ICERC20(_cTokenAddress).borrow(_amount) == 0, "borrowAsset() ICERC20.borrow failed.");
    }

    function repayBorrowedAsset(address _cTokenAddress, uint256 _amount) public {
        require(managers[msg.sender] || msg.sender == owner(), "not permitted to repay borrowed");
        if (_cTokenAddress == CETH) {
            require(ICEther(_cTokenAddress).repayBorrow.value(_amount)() == 0, "repayBorrowAsset() ICEther.repayBorrow failed.");
        } else {
            require(ICERC20(_cTokenAddress).repayBorrow(_amount) == 0, "repayBorrowAsset() ICERC20.repayBorrow failed.");
        }
    }

    function reserveBalance() public view returns (uint256) {
        return totalDepositedReserve;
    }

    function reserveDifferential() public view returns (uint256 differential, bool isSolvent) {
        uint256 underlyingBalance = cReserveToken.balanceOfUnderlying(address(this));
        if (underlyingBalance >= totalDepositedReserve) {
            return (underlyingBalance.sub(totalDepositedReserve), true);
        }

        return (totalDepositedReserve.sub(underlyingBalance), false);
    }
}