import { Event, EventFilter } from '@ethersproject/contracts'
import { JsonRpcProvider } from '@ethersproject/providers'
import {
    Block,
    L1Contract
} from '../zkopru/packages/core'
import { Proposal } from '../zkopru/packages/database'
import { ICoordinatable__factory } from '../zkopru/packages/contracts'

interface L2Block extends Omit<Proposal, "hash" | "fetched"> {
    proposedAt: number
    proposalTx: string
    proposalNum: number
    block: Block
}

export interface EventRes<R> extends Omit<Event, 'args'> {
    args: R
}

interface FinalizeEventData {
    blockHash: string
}

interface ProposalEventData {
    proposalNum: number,
    blockHash: string
}

export class ZkopruBlockData {
    provider: JsonRpcProvider

    latestBlockNumber: number

    zkopruAddress: string

    l1Contract: L1Contract

    l2BlockData: { [hash: string]: L2Block }

    latestProposal: { proposalNum: number, proposalHashes: string[] }

    searchEventRange?: { lowerBound: number, upperBound: number }

    constructor(provider: JsonRpcProvider, zkopruAddress: string) {
        this.provider = provider
        this.zkopruAddress = zkopruAddress
        this.l1Contract = new L1Contract(this.provider, this.zkopruAddress)
        this.latestBlockNumber = -1
        this.l2BlockData = {}
        this.latestProposal = { proposalNum: -1, proposalHashes: [] }
    }

    async init(range?: { from?: number, to?: number }) {
        // check connection via get latest blockNumber
        try {
            this.latestBlockNumber = await this.provider.getBlockNumber()
        } catch (error) {
            throw Error(`could not get block number from provider - ${error as any}`)
        }

        // set search boundary on Layer1 blocks
        const lowerBound = range?.from ?? 0
        const upperBound = range?.to ? Math.min(range.to, this.latestBlockNumber) : this.latestBlockNumber

        this.searchEventRange = { lowerBound, upperBound }

        try {
            const config = await this.l1Contract.getConfig()
            if (!config) {
                throw Error(`could not get config from zkopru contract`)
            }
        } catch (error) {
            throw Error(`may not the address of zkopru contract, check contract address`)
        }
    }

    async getPastEvents<R>(
        eventFilter: EventFilter,
        stopTrigger?: (event: EventRes<R>) => boolean
    ): Promise<EventRes<R>[]> {
        if (!this.searchEventRange) throw Error(`Not initialized yet`)
        const { lowerBound, upperBound } = this.searchEventRange

        const SCAN_SPEN = 10000

        let searchContinue = true
        let currentBlockPoint = upperBound

        const coordinator = ICoordinatable__factory.connect(
            this.zkopruAddress,
            this.provider
        )

        let eventData: EventRes<R>[] = []

        while (searchContinue) {
            currentBlockPoint -= SCAN_SPEN

            // query events to L1 node
            const events = await coordinator.queryFilter(
                eventFilter,
                Math.max(currentBlockPoint - SCAN_SPEN - 1, lowerBound),
                currentBlockPoint,
            ) as EventRes<R>[]

            // check next search
            if (events) {
                for (const event of [events].flat()) {
                    eventData.push(event)

                    // if trigger mat, return event data
                    if (stopTrigger && stopTrigger(event)) {
                        return eventData
                    }
                }
            }
            if (currentBlockPoint <= lowerBound) searchContinue = false
        }
        return eventData
    }

    async updateProposalData() {
        const newProposalFilter = this.l1Contract.coordinator.filters.NewProposal()
        const stopEventAt = (eventArgs: EventRes<ProposalEventData>) => {
            if (eventArgs.args.proposalNum == 1) {
                return true
            }
            return false
        }
        // get event data and process txData to class
        const newProposalEvents = await this.getPastEvents<ProposalEventData>(newProposalFilter, stopEventAt)
        for (const event of newProposalEvents) {
            const { transactionHash, blockNumber } = event
            const { proposalNum, blockHash } = event.args
            const blockTx = await this.provider.getTransaction(transactionHash)
            const block = Block.fromTx(blockTx)

            // update block data
            this.l2BlockData[blockHash] = {
                proposedAt: blockNumber,
                proposalTx: transactionHash,
                proposalNum,
                block,
            }

            // update latest proposal data point
            if (proposalNum == this.latestProposal.proposalNum) {
                this.latestProposal.proposalHashes.push(blockHash)
            }
            if (proposalNum > this.latestProposal.proposalNum) {
                this.latestProposal.proposalNum = proposalNum
                this.latestProposal.proposalHashes = [blockHash]
            }
        }
    }

    async searchFinalizeEvents() {
        const finalizeFilter = this.l1Contract.coordinator.filters.Finalized()
        const finalizeEvents = await this.getPastEvents<FinalizeEventData>(finalizeFilter)
        return finalizeEvents // TODO: no return, update data to class 
    }
}
