// require("@nomiclabs/hardhat-web3");
// import Web3 from 'web3'
import { extendEnvironment, HardhatUserConfig } from "hardhat/config"
import "@nomiclabs/hardhat-web3"

// extendEnvironment((hre) => {
//   hre.Web3 = Web3

//   // hre.network.provider is an EIP1193-compatible provider.
//   const provider = new Web3.providers.WebsocketProvider('ws://locahost:8545')
//   // hre.web3 = new Web3(provider)
//   hre.web3 = new Web3(provider)
// })

extendEnvironment((hre) => {
  const Web3 = require("web3");
  hre.Web3 = Web3;

  // hre.network.provider is an EIP1193-compatible provider.
  hre.web3 = new Web3(hre.network.provider);
});

const config: HardhatUserConfig = {
  solidity: "0.7.4",
  networks: {
    localhost: {
      url: "http://localhost:8545",
    }
  }
}

module.exports = config
