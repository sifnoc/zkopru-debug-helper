import { HardhatUserConfig } from "hardhat/config"

const url: string = process.env.URL ?? ''
const blockNumber: number = parseInt(process.env.BLOCK_NUMBER ?? '0', 10)
const chainId: number = parseInt(process.env.CHAINID ?? '31337', 10) // hardhat default chainId 31337

let network = {}

if (url !== '') {
  network = {
    hardhat: {
      forking: {
        url,
        blockNumber: blockNumber == 0 ? undefined : blockNumber
      },
      chainId,
    }
  }
}

const config: HardhatUserConfig = {
  solidity: "0.7.4",
  networks: { ...network }
}

module.exports = config
