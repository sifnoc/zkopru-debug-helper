// import hre from 'hardhat'
import { HttpNetworkConfig, EthereumProvider } from 'hardhat/types'
import { createProvider } from 'hardhat/internal/core/providers/construction'
import { rpcBlock } from 'hardhat/internal/core/jsonrpc/types/output/block'
import { decodeJsonRpcResponse } from 'hardhat/internal/core/jsonrpc/types/output/decodeJsonRpcResponse'

enum MiningMode {
  STOPPED,
  MANUAL,
  INSTANT,
  INTERVAL,
}

export class HreController {
  currentBlockNum: number

  currentMiningMode: MiningMode

  provider: EthereumProvider

  constructor(nodeUrl?: string) {
    this.currentBlockNum = -1
    this.currentMiningMode = MiningMode.INSTANT

    const localConfig: HttpNetworkConfig = {
      accounts: "remote",
      gas: "auto",
      gasPrice: "auto",
      gasMultiplier: 1,
      httpHeaders: {},
      timeout: 40000,
      url: nodeUrl ?? 'http://localhost:8545'
    }

    this.provider = createProvider(`remoteNode`, localConfig)
  }

  static async getBlockNumber(provider: EthereumProvider) {
    const rawResponse = await provider.send("eth_getBlockByNumber", ['latest', false])
    return decodeJsonRpcResponse(rawResponse, rpcBlock)
  }

  async updateBlockNumber() {
    const block = await HreController.getBlockNumber(this.provider)
    this.currentBlockNum = block.number?.toNumber() ?? -1
  }

  async resetFork(blockNumber: number) {
    try {
      await this.provider.request({
        method: "hardhat_reset",
        params: [
          {
            forking: {
              jsonRpcUrl: process.env.JSONRPC_URL ?? 'http://localhost:8545',
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
      await this.provider.send("evm_mine");
      this.currentMiningMode = MiningMode.MANUAL
    } catch (error) {
      this.currentMiningMode = MiningMode.STOPPED
      throw Error(`Failed move next block - ${error}`)
    }
  }

  // Instant Mode
  async startInstantMine() {
    try { 
      await this.provider.send("evm_setIntervalMining", [])
      this.currentMiningMode = MiningMode.INSTANT
    } catch (error) {
      this.currentMiningMode = MiningMode.STOPPED
      throw Error(`Failed set instant mining mode - ${error}`)
    }
  }

  // Interval Mode
  async startAutoMine(interval: number) {
    try { 
      await this.provider.send("evm_setIntervalMining", [interval])
      this.currentMiningMode = MiningMode.INTERVAL
    } catch (error) {
      this.currentMiningMode = MiningMode.STOPPED
      throw Error(`Failed to start Inerval mining - ${error}`)
    }
  }

  async stopAutoMine() {
    try { 
      await this.provider.send("evm_setIntervalMining", [0])
      this.currentMiningMode = MiningMode.STOPPED
    } catch (error) {
      throw Error(`Failed move next block - ${error}`)
    }
  }
}
