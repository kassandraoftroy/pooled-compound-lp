const { ethers, network } = require('hardhat');

const approve = async (admin, tokenAddress, approveAddress, amount) => {
    const c = await ethers.getContractAt(["function approve(address,uint256) external"], tokenAddress, admin);
    tx = await c.approve(approveAddress, amount);
    console.log(tx.hash);
}


(async () => {
    const [admin] = await ethers.getSigners();
    const tokAddr = network.config.daiAddress;
    const approveAddr = "0x5094590f60C8c9f59d370A35a52e7436D39Eb05d";
    const amount = ethers.utils.parseEther("125");
    await approve(admin, tokAddr, approveAddr, amount);
})();