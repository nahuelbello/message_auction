async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  
  const MessageAuction = await ethers.getContractFactory("MessageAuction");
  const contract = await MessageAuction.deploy();
  
  // Espera a que el contrato se despliegue por completo:
  await contract.deployed();
  
  console.log("MessageAuction deployed to:", contract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });