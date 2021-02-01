const { ethers, deployments, network } = require("hardhat");
const { expect } = require("chai");
const { getDaiFromFaucet } = require("./helper");

const maxInt256 = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"

describe("PooledLPWithBorrowToken", async function () {
  let contract;
  let admin;
  let user;
  let adminAddress;
  let userAddress;
  let initialDepositAmount;
  let dai;
  let cDai;
  this.timeout(0);

  before(async function () {
    await deployments.fixture();
    [admin, user] = await ethers.getSigners();
    adminAddress = await admin.getAddress();
    userAddress = await user.getAddress();
    contract = await ethers.getContract("PooledLPWithBorrowToken");
    initialDepositAmount = 1000;
    dai = await ethers.getContractAt("IERC20", network.config.daiAddress, admin);
    cDai = await ethers.getContractAt("ICERC20", network.config.cDaiAddress, user);
    console.log("    Contract address:", contract.address);
  });

  it("test token activation", async () => {
    // acquire some DAI
    await getDaiFromFaucet(adminAddress, ethers.utils.parseEther((initialDepositAmount*2).toString()));

    // activate contract (deployer lends initial deposit amount to Compound)
    await dai.approve(contract.address, ethers.utils.parseEther(initialDepositAmount.toString()));
    const tx = await contract.activate(ethers.constants.AddressZero);
    expect((await dai.balanceOf(adminAddress)).toString()).to.be.eq(ethers.utils.parseEther(initialDepositAmount.toString()).toString());
    console.log(`    initial deposit: ${ethers.utils.formatEther(await contract.reserveBalance())} DAI`);
    console.log(`    initial supply: ${ethers.utils.formatEther(await contract.totalSupply())} DAOTok`);
  });
  it("test interest accrues", async () => {
    // random user borrows dai and pays it back
    const userAmount = 200000;
    await getDaiFromFaucet(userAddress, ethers.utils.parseEther(userAmount.toString()));

    await dai.connect(user).approve(network.config.cDaiAddress, ethers.utils.parseEther((userAmount/2).toString()));
    await cDai.mint(ethers.utils.parseEther((userAmount/2).toString()));
    expect((await dai.balanceOf(userAddress)).toString()).to.be.eq(ethers.utils.parseEther((userAmount/2).toString()).toString());
    await cDai.borrow(ethers.utils.parseEther((userAmount/4).toString()));
    expect((await dai.balanceOf(userAddress)).toString()).to.be.eq(ethers.utils.parseEther((userAmount*3/4).toString()).toString());
    for (let i = 0; i < 5000; i++) {
      const block = await admin.provider.getBlock();
      const executionTime = block.timestamp + 300;
      await admin.provider.send('evm_mine', [executionTime]);
    }
    await dai.connect(user).approve(network.config.cDaiAddress, ethers.utils.parseEther("100000"));
    await cDai.repayBorrow(maxInt256);

    const resp = await contract.reserveDifferential();
    expect(resp.isSolvent).to.be.eq(true);
    console.log(`    interest (after 5000 blocks): ${ethers.utils.formatEther(resp.differential)} DAI`);
    expect(Number(ethers.utils.formatEther(resp.differential))).to.be.gt(0);
  });

  it("test mint tokens", async () => {
    console.log('    mint simulation:');
    const depositAmount = ethers.utils.parseEther((initialDepositAmount*10).toString());
    for (let i=0; i < 5; i++) {
      const daiBalanceBefore = await dai.balanceOf(userAddress);
      await dai.connect(user).approve(contract.address, depositAmount);
      const balanceBefore = await contract.balanceOf(userAddress);
      await contract.connect(user).mint(depositAmount, 0);
      const balanceAfter = await contract.balanceOf(userAddress);
      const daiBalanceAfter = await dai.balanceOf(userAddress);
      const daiBalanceChange = Number(ethers.utils.formatEther(daiBalanceBefore))-Number(ethers.utils.formatEther(daiBalanceAfter));
      const DAOTokBalanceChange = Number(ethers.utils.formatEther(balanceAfter))-Number(ethers.utils.formatEther(balanceBefore));
      expect(daiBalanceChange.toFixed(3)).to.be.eq((initialDepositAmount*10).toFixed(3));
      console.log(`    ${daiBalanceChange.toFixed(3)} DAI mints ${DAOTokBalanceChange.toFixed(3)} (avg price: ${(daiBalanceChange/DAOTokBalanceChange).toFixed(4)} DAI = 1 DAOTok)`)
    }
  });
  it("test burn tokens", async () => {
    const initialBalance = await dai.balanceOf(adminAddress);
    const initialDAOTok = await contract.balanceOf(adminAddress);
    console.log('    burn simulation:');
    console.log(`    total supply before burn: ${ethers.utils.formatEther(await contract.totalSupply())} DAOTok`);
    console.log(`    total DAI reserves: ${ethers.utils.formatEther(await contract.reserveBalance())} DAI`);
    await contract.connect(admin).burn(initialDAOTok, 0);
    const DAOTokBurned = Number(ethers.utils.formatEther(initialDAOTok)) - Number(ethers.utils.formatEther(await contract.balanceOf(adminAddress)));
    const daiReceived = Number(ethers.utils.formatEther(await dai.balanceOf(adminAddress))) - Number(ethers.utils.formatEther(initialBalance));
    expect(DAOTokBurned.toFixed(3)).to.be.eq(Number(ethers.utils.formatEther(initialDAOTok)).toFixed(3));
    expect(daiReceived).to.be.gt(0);
    console.log(`    Burn: ${DAOTokBurned} DAOTok`);
    console.log(`    Receive: ${daiReceived} DAI`);
  });
  it("test only treasury can withdraw interest", async () => {
    const resp = await contract.reserveDifferential();
    expect(resp.isSolvent).to.be.eq(true);
    const accrued = resp.differential;
    try {
      await contract.connect(user).withdrawInterest(accrued);
      throw Error('user withdraw interest should be reverted');
    } catch(e) {}
    const daiBalance = await dai.balanceOf(adminAddress);
    await contract.connect(admin).withdrawInterest(accrued);
    const daiChange = Number(ethers.utils.formatEther(await dai.balanceOf(adminAddress))) - Number(ethers.utils.formatEther(daiBalance));
    expect(daiChange.toFixed(4)).to.be.eq(Number(ethers.utils.formatEther(accrued)).toFixed(4));
  });
  it("test claim and withdraw COMP", async () => {
    const comptrollerAbi = ["function claimComp(address) external"];
    const comptroller = await ethers.getContractAt(comptrollerAbi, network.config.comptrollerAddress, user);
    await comptroller.claimComp(contract.address);
    const comp = await ethers.getContractAt("IERC20", network.config.compAddress);
    const bal = await comp.balanceOf(contract.address);
    expect(Number(bal.toString())).to.be.gt(0);
    try {
      await contract.connect(user).withdrawToken(network.config.compAddress, bal);
      throw Error('user withdraw interest should be reverted');
    } catch(e) {}
    await contract.connect(admin).withdrawToken(network.config.compAddress, bal);
    const bal2 = await comp.balanceOf(adminAddress);
    expect(Number(bal.toString())).to.be.eq(Number(bal2.toString()));
  });
  it("test withdraw ETH", async () => {
    await user.sendTransaction({
      to: contract.address,
      value: ethers.utils.parseEther("1"),
    })
    const bal = await admin.provider.getBalance(contract.address);
    expect(Number(bal.toString())).to.be.gt(0);
    try {
      await contract.connect(user).withdrawToken(network.config.ethAddress, bal);
      throw Error('user withdraw interest should be reverted');
    } catch(e) {}
    await contract.connect(admin).withdrawToken(network.config.ethAddress, bal);
    const weth = await ethers.getContractAt("IERC20", network.config.wethAddress);
    const bal2 = await weth.balanceOf(adminAddress);
    expect(Number(bal.toString())).to.be.eq(Number(bal2.toString()));
  });
});
