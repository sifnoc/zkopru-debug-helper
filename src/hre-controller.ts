// import hre from 'hardhat'
import { HardhatRuntimeEnvironment as HRE } from 'hardhat/types'

export class HreController {
  hre: HRE

  currentBlockNum: number

  constructor(hre: HRE) {
    this.hre = hre
    this.currentBlockNum = 0
  }

  static async getBlockNumber(hre: HRE) {
    return await hre.network.provider.send("eth_getBlockByNumber", ['latest', false])
  }

  async updateBlockNumber() {
    const block = await HreController.getBlockNumber(this.hre)
    this.currentBlockNum = parseInt(block.number, 16)
  }

  async resetFork(blockNumber: number) {
    await this.hre.network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: process.env.JSONRPC_URL ?? 'https://localhost:8545',
            blockNumber,
          },
        },
      ],
    })
    await this.updateBlockNumber()
  }

  async nextBlock() {
    await this.hre.network.provider.send("evm_mine");
  }

  async startAutoMine(interval: number) {
    await this.hre.network.provider.send("evm_setIntervalMining", [interval])
  }

  async stopAutoMine() {
    await this.hre.network.provider.send("evm_setIntervalMining", [0])
  }
}
