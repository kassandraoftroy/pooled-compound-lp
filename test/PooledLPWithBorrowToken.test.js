const { ethers, deployments, network } = require("hardhat");
const { expect } = require("chai");
const { getDaiFromFaucet } = require("./helper");

const maxInt256 = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"

describe("PooledLPToken", async function () {
  let daoToken;
  let governor;
  let timelock;
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
    daoToken = await ethers.getContract("PooledLPWithBorrowToken");
    governor = await ethers.getContract("GovernorAlpha");
    timelock = await ethers.getContract("Timelock");
    initialDepositAmount = 1000;
    dai = await ethers.getContractAt("IERC20", network.config.daiAddress, admin);
    cDai = await ethers.getContractAt("ICERC20", network.config.cDaiAddress, user);
    console.log("    Contract address:", daoToken.address);
  });

  it("test token activation", async () => {
    // acquire some DAI
    await getDaiFromFaucet(adminAddress, ethers.utils.parseEther((initialDepositAmount*2).toString()));

    // activate daoToken (deployer lends initial deposit amount to Compound)
    await dai.approve(daoToken.address, ethers.utils.parseEther(initialDepositAmount.toString()));
    const tx = await daoToken.activate(ethers.constants.AddressZero);
    expect((await dai.balanceOf(adminAddress)).toString()).to.be.eq(ethers.utils.parseEther(initialDepositAmount.toString()).toString());
    console.log(`    initial deposit: ${ethers.utils.formatEther(await daoToken.reserveBalance())} DAI`);
    console.log(`    initial supply: ${ethers.utils.formatEther(await daoToken.totalSupply())} DAOTok`);
  });

  it("test mint tokens", async () => {
    const userAmount = 225000;
    await getDaiFromFaucet(userAddress, ethers.utils.parseEther(userAmount.toString()));

    console.log('    mint simulation:');
    const depositAmount = ethers.utils.parseEther((initialDepositAmount*10).toString());
    for (let i=0; i < 10; i++) {
      const daiBalanceBefore = await dai.balanceOf(userAddress);
      await dai.connect(user).approve(daoToken.address, depositAmount);
      const balanceBefore = await daoToken.balanceOf(userAddress);
      await daoToken.connect(user).mint(depositAmount, 0);
      const balanceAfter = await daoToken.balanceOf(userAddress);
      const daiBalanceAfter = await dai.balanceOf(userAddress);
      const daiBalanceChange = Number(ethers.utils.formatEther(daiBalanceBefore))-Number(ethers.utils.formatEther(daiBalanceAfter));
      const DAOTokBalanceChange = Number(ethers.utils.formatEther(balanceAfter))-Number(ethers.utils.formatEther(balanceBefore));
      expect(daiBalanceChange.toFixed(3)).to.be.eq((initialDepositAmount*10).toFixed(3));
      console.log(`    ${daiBalanceChange.toFixed(3)} DAI mints ${DAOTokBalanceChange.toFixed(3)} (avg price: ${(daiBalanceChange/DAOTokBalanceChange).toFixed(4)} DAI = 1 DAOTok)`)
    }
  });

  it("test interest accrues", async () => {
    // random user borrows dai and pays it back
    const userAmount = Number(ethers.utils.formatEther(await dai.balanceOf(userAddress)));
    await dai.connect(user).approve(network.config.cDaiAddress, ethers.utils.parseEther((userAmount/2).toString()));
    await cDai.mint(ethers.utils.parseEther((userAmount/2).toString()));
    expect((await dai.balanceOf(userAddress)).toString()).to.be.eq(ethers.utils.parseEther((userAmount/2).toString()).toString());
    await cDai.borrow(ethers.utils.parseEther((userAmount/4).toString()));
    expect((await dai.balanceOf(userAddress)).toString()).to.be.eq(ethers.utils.parseEther((userAmount*3/4).toString()).toString());
    for (let i = 0; i < 500; i++) {
      const block = await admin.provider.getBlock();
      const executionTime = block.timestamp + 15;
      await admin.provider.send('evm_mine', [executionTime]);
    }
    await dai.connect(user).approve(network.config.cDaiAddress, ethers.utils.parseEther("100000"));
    await cDai.repayBorrow(maxInt256);

    const resp = await daoToken.reserveDifferential();
    expect(resp.isSolvent).to.be.eq(true);
    console.log(`    interest (after 500 blocks): ${ethers.utils.formatEther(resp.differential)} DAI`);
    expect(Number(ethers.utils.formatEther(resp.differential))).to.be.gt(0);
  });

  it("test only treasury can withdraw interest", async () => {
    const resp = await daoToken.reserveDifferential();
    expect(resp.isSolvent).to.be.eq(true);
    const accrued = resp.differential;
    try {
      await daoToken.connect(user).withdrawInterest(accrued);
      throw Error('user withdraw interest should be reverted');
    } catch(e) {}
    const daiBalance = await dai.balanceOf(adminAddress);
    await daoToken.connect(admin).withdrawInterest(accrued);
    const daiChange = Number(ethers.utils.formatEther(await dai.balanceOf(adminAddress))) - Number(ethers.utils.formatEther(daiBalance));
    expect(daiChange.toFixed(4)).to.be.eq(Number(ethers.utils.formatEther(accrued)).toFixed(4));
  });

  it("test claim and withdraw COMP", async () => {
    const comptrollerAbi = ["function claimComp(address) external"];
    const comptroller = await ethers.getContractAt(comptrollerAbi, network.config.comptrollerAddress, user);
    await comptroller.claimComp(daoToken.address);
    const comp = await ethers.getContractAt("IERC20", network.config.compAddress);
    const bal = await comp.balanceOf(daoToken.address);
    expect(Number(bal.toString())).to.be.gt(0);
    try {
      await daoToken.connect(user).withdrawToken(network.config.compAddress, bal);
      throw Error('user withdraw interest should be reverted');
    } catch(e) {}
    await daoToken.connect(admin).withdrawToken(network.config.compAddress, bal);
    const bal2 = await comp.balanceOf(adminAddress);
    expect(Number(bal.toString())).to.be.eq(Number(bal2.toString()));
  });

  it("test withdraw ETH", async () => {
    await user.sendTransaction({
      to: daoToken.address,
      value: ethers.utils.parseEther("1"),
    })
    const bal = await admin.provider.getBalance(daoToken.address);
    expect(Number(bal.toString())).to.be.gt(0);
    try {
      await daoToken.connect(user).withdrawToken(network.config.ethAddress, bal);
      throw Error('user withdraw interest should be reverted');
    } catch(e) {}
    await daoToken.connect(admin).withdrawToken(network.config.ethAddress, bal);
    const weth = await ethers.getContractAt("IERC20", network.config.wethAddress);
    const bal2 = await weth.balanceOf(adminAddress);
    expect(Number(bal.toString())).to.be.eq(Number(bal2.toString()));
  });

  it("test GovernorAlpha and Timelock Governance Actions", async () => {
    const name = await governor.name();
    expect(name).to.be.eq("PooledLP Governor Alpha");
    let tadmin = await timelock.admin();
    expect(tadmin).to.be.eq(adminAddress);
    const sig = "setPendingAdmin(address)";
    let block = await admin.provider.getBlock();
    const executionTime = (block.timestamp+650).toString();
    let data = ethers.utils.defaultAbiCoder.encode(["address"], [governor.address]);
    await timelock.connect(admin).queueTransaction(timelock.address, 0, sig, data, executionTime);
    block = await admin.provider.getBlock();
    let nextBlockTime = block.timestamp + 1200;
    await admin.provider.send('evm_mine', [nextBlockTime]);
    await timelock.connect(admin).executeTransaction(timelock.address, 0, sig, data, executionTime);
    await governor.connect(user).acceptAdmin();
    tadmin = await timelock.admin();
    expect(tadmin).to.be.eq(governor.address);
    await daoToken.connect(admin).transferOwnership(timelock.address);
    const tokOwner = await daoToken.owner();
    expect(tokOwner).to.be.eq(timelock.address);

    // accrue interest
    const amt = 40000;
    await getDaiFromFaucet(adminAddress, ethers.utils.parseEther(amt.toString()));
    await dai.connect(admin).approve(network.config.cDaiAddress, ethers.utils.parseEther((amt/2).toString()));
    await cDai.borrow(ethers.utils.parseEther((amt/4).toString()));
    for (let i = 0; i < 500; i++) {
      const blk = await admin.provider.getBlock();
      const executionTime = blk.timestamp + 15;
      await admin.provider.send('evm_mine', [executionTime]);
    }
    await dai.connect(admin).approve(network.config.cDaiAddress, ethers.utils.parseEther("100000"));
    await cDai.repayBorrow(maxInt256);

    const adminBalance = await daoToken.balanceOf(adminAddress);
    const userBalance = await daoToken.balanceOf(userAddress);

    expect(Number(ethers.utils.formatEther(adminBalance+userBalance))).to.be.gt(1000000);

    await daoToken.connect(admin).delegate(userAddress);
    await daoToken.connect(user).delegate(userAddress);

    const votes = await daoToken.getCurrentVotes(userAddress);

    expect(Number(ethers.utils.formatEther(votes))).to.be.gt(1000000);

    const resp = await daoToken.reserveDifferential();
    data = ethers.utils.defaultAbiCoder.encode(["uint256"], [resp.differential]);
    await governor.connect(user).propose([daoToken.address], [0], ["withdrawInterest(uint256)"], [data], "withdraw interest");
    

    block = await admin.provider.getBlock();
    nextBlockTime = block.timestamp + 15;
    await admin.provider.send('evm_mine', [nextBlockTime]);
    block = await admin.provider.getBlock();
    nextBlockTime = block.timestamp + 15;
    await admin.provider.send('evm_mine', [nextBlockTime]);

    await governor.connect(user).castVote("1", true);

    for (let i = 0; i < 40320; i++) {
      await admin.provider.send('evm_mine', []);
    }

    await governor.connect(admin).queue("1");

    block = await admin.provider.getBlock();
    nextBlockTime = block.timestamp + 1000;
    await admin.provider.send('evm_mine', [nextBlockTime]);

    const preBalance = await dai.balanceOf(timelock.address);

    await governor.connect(admin).execute("1");

    const postBalance = await dai.balanceOf(timelock.address);

    expect(Number(ethers.utils.formatEther(postBalance))).to.be.gt(Number(ethers.utils.formatEther(preBalance)));
  });

  it("test burn tokens", async () => {
    const initialBalance = await dai.balanceOf(adminAddress);
    const initialDAOTok = await daoToken.balanceOf(adminAddress);
    console.log('    burn simulation:');
    console.log(`    total supply before burn: ${ethers.utils.formatEther(await daoToken.totalSupply())} DAOTok`);
    console.log(`    total DAI reserves: ${ethers.utils.formatEther(await daoToken.reserveBalance())} DAI`);
    await daoToken.connect(admin).burn(initialDAOTok, 0);
    const DAOTokBurned = Number(ethers.utils.formatEther(initialDAOTok)) - Number(ethers.utils.formatEther(await daoToken.balanceOf(adminAddress)));
    const daiReceived = Number(ethers.utils.formatEther(await dai.balanceOf(adminAddress))) - Number(ethers.utils.formatEther(initialBalance));
    expect(DAOTokBurned).to.be.eq(Number(ethers.utils.formatEther(initialDAOTok)));
    expect(daiReceived).to.be.gt(0);
    console.log(`    Burn: ${DAOTokBurned} DAOTok`);
    console.log(`    Receive: ${daiReceived} DAI`);
  });
});
