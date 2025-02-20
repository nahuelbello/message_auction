require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config(); // Si usás variables de entorno para guardar tu private key

module.exports = {
  solidity: "0.8.18",
  networks: {
    // Tu config de localhost para el nodo local:
    localhost: {
      url: "http://127.0.0.1:8545",
    },
   
    },
  }