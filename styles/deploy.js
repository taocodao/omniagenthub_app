async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);

    const RemoveNFTContract = await ethers.getContractFactory("RemoveNFTContract");
    const removeNFTContract = await RemoveNFTContract.deploy();

    console.log("RemoveNFTContract deployed to:", removeNFTContract.address);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
