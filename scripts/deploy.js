async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const MessageAuction = await ethers.getContractFactory("MessageAuction");
  const contract = await MessageAuction.deploy();

  // Espera a que la transacción de despliegue se confirme:
  await contract.waitForDeployment();
  console.log("Contrato desplegado en:", contract.target);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
