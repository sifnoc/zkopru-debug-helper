// import hre from 'hardhat'
import { HardhatRuntimeEnvironment as HRE } from 'hardhat/types'

enum MiningMode {
  STOPPED,
  MANUAL,
  INSTANT,
  INTERVAL,
}

export class HreController {
  hre: HRE

  currentBlockNum: number

  currentMiningMode: MiningMode

  constructor(hre: HRE) {
    this.hre = hre
    this.currentBlockNum = 0
    this.currentMiningMode = MiningMode.STOPPED
  }

  static async getBlockNumber(hre: HRE) {
    return await hre.network.provider.send("eth_getBlockByNumber", ['latest', false])
  }

  async updateBlockNumber() {
    const block = await HreController.getBlockNumber(this.hre)
    this.currentBlockNum = parseInt(block.number, 16)
  }

  async resetFork(blockNumber: number) {
    try {
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
    } catch (error) {
      throw Error(`Failed reset fork at ${blockNumber} - ${error}`)
    }
    this.currentMiningMode = MiningMode.STOPPED
  }

  // Manual Mode
  async nextBlock() {
    try {
      await this.hre.network.provider.send("evm_mine");
      this.currentMiningMode = MiningMode.MANUAL
    } catch (error) {
      this.currentMiningMode = MiningMode.STOPPED
      throw Error(`Failed move next block - ${error}`)
    }
  }

  // Instant Mode
  async startInstantMine() {
    try { 
      await this.hre.network.provider.send("evm_setIntervalMining", [])
      this.currentMiningMode = MiningMode.INSTANT
    } catch (error) {
      this.currentMiningMode = MiningMode.STOPPED
      throw Error(`Failed set instant mining mode - ${error}`)
    }
  }

  // Interval 
  async startAutoMine(interval: number) {
    try { 
      await this.hre.network.provider.send("evm_setIntervalMining", [interval])
      this.currentMiningMode = MiningMode.INTERVAL
    } catch (error) {
      this.currentMiningMode = MiningMode.STOPPED
      throw Error(`Failed to start Inerval mining - ${error}`)
    }
  }

  async stopAutoMine() {
    try { 
      await this.hre.network.provider.send("evm_setIntervalMining", [0])
      this.currentMiningMode = MiningMode.STOPPED
    } catch (error) {
      throw Error(`Failed move next block - ${error}`)
    }
  }
}
