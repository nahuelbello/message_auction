async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  
  const MessageAuction = await ethers.getContractFactory("MessageAuction");
  const contract = await MessageAuction.deploy();
  
  // Espera a que la transacción se mine y obtiene el recibo:
  const receipt = await contract.deployTransaction.wait();
  console.log("MessageAuction deployed to:", receipt.contractAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });