const { ethers, deployments, network } = require("hardhat");
const { expect } = require("chai");
const { getDaiFromFaucet } = require("./helper");

const maxInt256 = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"

describe("Continuous Token With Lending", async function () {
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
    contract = await ethers.getContract("ContinuousTokenWithLending");
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
    await contract.activate(ethers.constants.AddressZero);
    expect((await dai.balanceOf(adminAddress)).toString()).to.be.eq(ethers.utils.parseEther(initialDepositAmount.toString()).toString());
    console.log(`\n\n    initial deposit: ${ethers.utils.formatEther(await contract.reserveBalance())} DAI`);
    console.log(`    initial supply: ${ethers.utils.formatEther(await contract.totalSupply())} CTWL`);
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

    console.log(`\n\n    interest (after 5000 blocks): ${ethers.utils.formatEther(await contract.reserveInterest())} DAI`);
    expect(Number(ethers.utils.formatEther(await contract.reserveInterest()))).to.be.gt(0);
  });

  it("test mint tokens", async () => {
    console.log('\n\n    mint simulation:');
    const depositAmount = ethers.utils.parseEther((initialDepositAmount*10).toString());
    for (let i=0; i < 5; i++) {
      const daiBalanceBefore = await dai.balanceOf(userAddress);
      await dai.connect(user).approve(contract.address, depositAmount);
      const balanceBefore = await contract.balanceOf(userAddress);
      await contract.connect(user).mint(depositAmount, 0);
      const balanceAfter = await contract.balanceOf(userAddress);
      const daiBalanceAfter = await dai.balanceOf(userAddress);
      const daiBalanceChange = Number(ethers.utils.formatEther(daiBalanceBefore))-Number(ethers.utils.formatEther(daiBalanceAfter));
      const CTWLBalanceChange = Number(ethers.utils.formatEther(balanceAfter))-Number(ethers.utils.formatEther(balanceBefore));
      expect(daiBalanceChange).to.be.eq(initialDepositAmount*10);
      console.log(`    ${daiBalanceChange.toFixed(3)} DAI mints ${CTWLBalanceChange.toFixed(3)} (avg price: ${(daiBalanceChange/CTWLBalanceChange).toFixed(4)} DAI = 1 CTWL)`)
    }
  });
  it("test burn tokens", async () => {
    const initialBalance = await dai.balanceOf(adminAddress);
    const initialCTWL = await contract.balanceOf(adminAddress);
    console.log('\n\n    burn simulation:');
    console.log(`    total supply before burn: ${ethers.utils.formatEther(await contract.totalSupply())} CTWL`);
    console.log(`    total DAI reserves: ${ethers.utils.formatEther(await contract.reserveBalance())} DAI`);
    await contract.connect(admin).burn(initialCTWL, 0);
    const CTWLBurned = Number(ethers.utils.formatEther(initialCTWL)) - Number(ethers.utils.formatEther(await contract.balanceOf(adminAddress)));
    const daiReceived = Number(ethers.utils.formatEther(await dai.balanceOf(adminAddress))) - Number(ethers.utils.formatEther(initialBalance));
    expect(CTWLBurned).to.be.eq(Number(ethers.utils.formatEther(initialCTWL)));
    expect(daiReceived).to.be.gt(0);
    console.log(`    Burn: ${CTWLBurned} CTWL`);
    console.log(`    Receive: ${daiReceived} DAI`);
  });
  it("test only treasury can withdraw interest", async () => {
    console.log(`\n\n`);
    const accrued = await contract.reserveInterest();
    try {
      await contract.connect(user).withdrawInterest(accrued);
      throw Error('user withdraw interest should be reverted');
    } catch(e) {}
    const daiBalance = await dai.balanceOf(adminAddress);
    await contract.connect(admin).withdrawInterest(accrued);
    const daiChange = Number(ethers.utils.formatEther(await dai.balanceOf(adminAddress))) - Number(ethers.utils.formatEther(daiBalance));
    expect(daiChange.toFixed(4)).to.be.eq(Number(ethers.utils.formatEther(accrued)).toFixed(4));
  });
});
