
module.exports = async (hre) => {
    if (hre.network.name === "mainnet") {
      console.log(
        "\n\n Deploying PooledLPWithBorrowToken to mainnet. Hit ctrl + c to abort"
      );
      console.log("❗ PooledLPWithBorrowToken DEPLOYMENT: VERIFY");
      await new Promise(r => setTimeout(r, 30000));
    }
    const { deployments } = hre;
    const { deploy } = deployments;
    const { deployer } = await hre.getNamedAccounts();
    await deploy("PooledLPWithBorrowToken", {
      from: deployer,
      args: [
        "Providing DAI liquidity and hedging crypto on Compound",
        "DAOTok",
        18,
        hre.ethers.utils.parseEther("100000"),
        hre.ethers.utils.parseEther("1000"),
        500000,
        hre.network.config.daiAddress,
        hre.network.config.cDaiAddress,
      ],
    });
};

module.exports.tags = ["PooledLPWithBorrowToken"];