
module.exports = async (hre) => {
    if (hre.network.name === "mainnet") {
      console.log(
        "\n\n Deploying ContinuousTokenWithLending to mainnet. Hit ctrl + c to abort"
      );
      console.log("❗ ContinuousTokenWithLending DEPLOYMENT: VERIFY");
      await new Promise(r => setTimeout(r, 30000));
    }
    const { deployments } = hre;
    const { deploy } = deployments;
    const { deployer } = await hre.getNamedAccounts();
  
    await deploy("ContinuousTokenWithLending", {
      from: deployer,
      args: [
        "Continuous Token With Lending",
        "CTWL",
        18,
        hre.ethers.utils.parseEther("100000"),
        hre.ethers.utils.parseEther("1000"),
        500000,
        hre.network.config.daiAddress,
        hre.network.config.cDaiAddress,
      ],
    });
};

module.exports.tags = ["ContinuousTokenWithLending"];