import { HardhatUserConfig } from "hardhat/config"

const config: HardhatUserConfig = {
  solidity: "0.7.4",
  networks: {
    localhost: {
      url: "http://localhost:8545",
    },
  }
}

module.exports = config
