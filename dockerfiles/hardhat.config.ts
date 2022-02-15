import { HardhatUserConfig } from "hardhat/config"

const url: string = process.env.URL ?? ''
const blockNumber: number = parseInt(process.env.BLOCK_NUMBER ?? '0', 10)

let networks = {}

if (url !== '') {
  networks = {
    hardhat: {
      forking: {
        url,
        blockNumber: blockNumber == 0 ? undefined : blockNumber
      }
    }
  }
}

const config: HardhatUserConfig = {
  solidity: "0.7.4",
  networks: { ...networks }
}

module.exports = config
