require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config(); // Si usás variables de entorno para guardar tu private key

module.exports = {
  solidity: "0.8.18",
  networks: {
    // Tu config de localhost para el nodo local:
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    // Agregamos la config para Sepolia:
    sepolia: {
      url: "https://eth-sepolia.g.alchemy.com/v2/TU_API_KEY", // La URL de Alchemy
      accounts: [process.env.PRIVATE_KEY], // Private key con ETH de prueba
    },
  },
};