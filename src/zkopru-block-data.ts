import {
    Block,
    L1Contract
} from '../zkopru/packages/core'
import { JsonRpcProvider } from '@ethersproject/providers'

interface L2Block {
    proposalNum: number
    blockHash: string
    proposedAt: number
    proposalTx: string
}

export class ZkopruBlockData {
    provider: JsonRpcProvider

    zkopruAddress: string

    latestBlockNumber: number

    L2blockData: L2Block[]

    constructor(provider: JsonRpcProvider, zkopruAddress: string) {
        this.provider = provider
        this.zkopruAddress = zkopruAddress
        this.latestBlockNumber = -1
        this.L2blockData = []
    }

    static async txHashtoBlock(provider: JsonRpcProvider, txhash: string): Promise<Block> {
        const tx = await provider.getTransaction(txhash)
        return Block.fromTx(tx)
    }

    async searchProposeEvents() {
        if (this.latestBlockNumber == -1) {
            this.latestBlockNumber = await this.provider.getBlockNumber()
        }
        const l1Contract = new L1Contract(this.provider, this.zkopruAddress) // looks warn but fine
        const newProposalFilter = l1Contract.coordinator.filters.NewProposal()

        const SCAN_SPEN = 10000
        let currentBlock = this.latestBlockNumber
        let latestL2Block = this.latestBlockNumber * 32 // TODO: check maximum L2 blocks in a L1 block in theor

        while (latestL2Block > 1) // start from first proposal (#0 is genesis)
        {
            const startBlockNum = currentBlock - SCAN_SPEN - 1
            const endBlockNum = currentBlock
            const events = await l1Contract.coordinator.queryFilter(
                newProposalFilter,
                startBlockNum,
                endBlockNum,
            )
            if (events) {
                console.log(`found events ${events.length}: fromBlock: ${startBlockNum}, toBlock: ${endBlockNum}`)
                for (const event of [events].flat()) {
                    const { args, blockNumber, transactionHash } = event
                    const { proposalNum, blockHash } = args
                    const newProposal = {
                        proposalNum: proposalNum.toNumber(),
                        blockHash: blockHash.toString(),
                        proposedAt: blockNumber,
                        proposalTx: transactionHash,
                    }
                    this.L2blockData.push(newProposal)

                    if (proposalNum <= latestL2Block) {
                        latestL2Block = proposalNum
                    }
                }
            }
            // move scan point
            currentBlock -= SCAN_SPEN
        }
    }

    // TODO
    async searchFinalizeEvents() {}

}