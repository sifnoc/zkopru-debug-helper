import {
    L1Contract } from '../zkopru/packages/core'
import { JsonRpcProvider } from '@ethersproject/providers'
import { ZkopruBlockData } from '../src/zkopru-block-data'


describe(`zkopru latest block data`, () => {
    const zkopruAddress = process.env.ZKOPRU_ADDRESS || '0x48458C823DF628f0C053B0786d4111529B9fB7B0'
    const providerUrl = 'https://goerli2-http.zkopru.network'
    let context: {
        provider: JsonRpcProvider
        latestBlockNumber: number
        L2blockData: {
            proposalNum: number
            blockHash: string
            proposedAt: number
            proposalTx: string
        }[]
    }

    const ctx = () => context

    beforeAll(async () => {
        const provider = new JsonRpcProvider(providerUrl)
        async function waitConnection() {
            return new Promise<void>(async res => {
                if (await provider.ready) return res()
                provider.on('connect', res)
            })
        }
        await waitConnection()
        const latestBlockNumber = await provider.getBlockNumber()
        context = { provider, latestBlockNumber, L2blockData: []}
    })

    it(`connect http provide`, async () => {
        const { provider } = ctx()
        const latestL1Block = await provider.getBlockNumber()
        expect(latestL1Block).toBeDefined()
    })

    it(`get data from zkopru contract`, async () => {
        const { provider } = ctx()
        const l1Contract = new L1Contract(provider, zkopruAddress) // looks warn but fine
        const config = await l1Contract.getConfig()
        expect(config).toBeDefined()
    })

    it(`test ZkopruBlockData class`, async () => {
        const { provider } = ctx()
        const zkopruBlockData = new ZkopruBlockData(provider, zkopruAddress)
        zkopruBlockData.latestBlockNumber = 5_910_000
        await zkopruBlockData.searchProposeEvents()
        expect(zkopruBlockData.L2blockData.length).toEqual(12)
    }, 50000)

})