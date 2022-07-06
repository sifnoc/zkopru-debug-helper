import { BigNumber } from 'ethers'
import { Event, EventFilter } from '@ethersproject/contracts'
import { JsonRpcProvider } from '@ethersproject/providers'
import {
    Block,
    L1Contract,
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
    proposalNum: BigNumber,
    blockHash: string
}

interface SearchRange {
    from?: number, 
    to?: number
}

export class ZkopruBlockData {
    provider: JsonRpcProvider

    latestL1BlockNumber: number

    zkopruAddress: string

    l1Contract: L1Contract

    latestProposal: { proposalNum: number, proposalHashes: string[] }

    l2BlockData: { [proposalHash: string]: L2Block }

    l2FinalizeData: { [proposalHash: string]: { finalizeTx: string, finalizedAt: number } }

    searchEventRange?: { lowerBound: number, upperBound: number }

    constructor(provider: JsonRpcProvider, zkopruAddress: string) {
        this.provider = provider
        this.zkopruAddress = zkopruAddress
        this.l1Contract = new L1Contract(this.provider, this.zkopruAddress)
        this.latestL1BlockNumber = -1
        this.l2BlockData = {}
        this.l2FinalizeData = {}
        this.latestProposal = { proposalNum: -1, proposalHashes: [] }
    }

    async init(range?: { from?: number, to?: number }) {
        // check connection via get latest blockNumber
        try {
            this.latestL1BlockNumber = await this.provider.getBlockNumber()
        } catch (error) {
            throw Error(`could not get block number from provider - ${error as any}`)
        }

        // set search boundary on Layer1 blocks
        const lowerBound = range?.from ?? 0
        const upperBound = range?.to ? Math.min(range.to, this.latestL1BlockNumber) : this.latestL1BlockNumber

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
        range?: SearchRange,
        stopTrigger?: (event: EventRes<R>) => boolean
    ): Promise<EventRes<R>[]> {
        if (!this.searchEventRange) throw Error(`Not initialized yet`)
        let { lowerBound, upperBound } = this.searchEventRange

        // override search range in case
        if (range?.from) lowerBound = range.from
        if (range?.to) upperBound = range.to

        // infura limit is that return result no more than 1000
        // alchemy limit is 2000 block range
        const SCAN_SPEN = 100000

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

    async updateFinalizeData(range?: SearchRange) {
        const finalizeFilter = this.l1Contract.coordinator.filters.Finalized()
        const finalizeEvents = await this.getPastEvents<FinalizeEventData>(finalizeFilter, range)
        for (const event of finalizeEvents) {
            const { transactionHash, blockNumber } = event
            const { blockHash } = event.args

            this.l2FinalizeData[blockHash] = {
                finalizeTx: transactionHash,
                finalizedAt: blockNumber
            }

            if (this.l2BlockData[blockHash]) this.l2BlockData[blockHash].finalized = true
        }
    }

    async updateProposalData(range?: SearchRange) {
        const newProposalFilter = this.l1Contract.coordinator.filters.NewProposal()
        const stopEventAt = (eventArgs: EventRes<ProposalEventData>) => {
            if (eventArgs.args.proposalNum.toNumber() == 1) {
                return true
            }
            return false
        }
        // get event data and process txData to class
        const newProposalEvents = await this.getPastEvents<ProposalEventData>(newProposalFilter, range, stopEventAt)
        for (const event of newProposalEvents) {
            const { transactionHash, blockNumber, args } = event
            const { proposalNum, blockHash } = args
            const l2BlockNum = proposalNum.toNumber()
            const blockTx = await this.provider.getTransaction(transactionHash)
            const block = Block.fromTx(blockTx)

            // update block data
            this.l2BlockData[blockHash] = {
                proposedAt: blockNumber,
                proposalTx: transactionHash,
                finalized: this.l2FinalizeData[blockHash] ? true : false,
                proposalNum: l2BlockNum,
                block,
            }

            // update latest proposal data point
            if (l2BlockNum == this.latestProposal.proposalNum) {
                this.latestProposal.proposalHashes.push(blockHash)
            }
            if (l2BlockNum > this.latestProposal.proposalNum) {
                this.latestProposal.proposalNum = l2BlockNum
                this.latestProposal.proposalHashes = [blockHash]
            }
        }
    }
}
