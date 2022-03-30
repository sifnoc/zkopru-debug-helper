import Docker from 'dockerode'
import { sleep } from '../zkopru/packages/utils/dist'
import { getContainers, removeContainer } from '../src/utils'
import { HreController } from '../src/hre-controller'

describe(`hardhat node controller`, () => {
  const containerName = `zkopru-hardhat-controller-test`
  const docker = new Docker({ socketPath: '/var/run/docker.sock' })
  let context: {
    container: Docker.Container,
    baseController: HreController,
    forkController?: HreController
  }
  const ctx = () => context

  beforeAll(async () => {
    const currentContainerId = await getContainers(containerName)
    if (currentContainerId) {
      console.log(`Found running '${containerName}' container, close: ${currentContainerId.slice(0, 8)}`)
      await removeContainer(currentContainerId)
    }
    const hardhatContainer = await docker.createContainer({
      Image: `zkopru-debug/hardhat`,
      name: containerName,
      HostConfig: {
        PortBindings: {
          "8545/tcp": [{ HostPort: "8545" }],
          "8546/tcp": [{ HostPort: "8546" }],
        }
      },
      // ExposedPorts: { "8545/tcp": {} }
    })
    await hardhatContainer.start()
    let containerInfo = await hardhatContainer.inspect()
    while (!containerInfo.State.Running) {
      await sleep(1000)
      containerInfo = await hardhatContainer.inspect()
    }
    // Assume that running this test on host 
    const containerIp = containerInfo.NetworkSettings.IPAddress
    await sleep(5000)
    context = {
      container: hardhatContainer,
      baseController: new HreController(`http://${containerIp}:8545`),
      forkController: new HreController(`http://${containerIp}:8546`)
    }
  }, 100000)

  afterAll(async () => {
    const { container } = ctx()
    await container.kill()
    await container.remove()
  }, 100000)

  it(`check hardhat node in container`, async () => {
    const { container } = ctx()
    expect(container.id).not.toBe(0)
  })

  it(`check initial controller state`, async () => {
    const { baseController } = ctx()
    expect(baseController.currentBlockNum).toBe(-1)
  })

  it(`check updated state on hardhat node`, async () => {
    const { baseController } = ctx()
    let lastestBlock = await baseController.getLatestBlock()
    expect(lastestBlock.number?.toString()).toBe(`0`)
  }, 50000)

  it(`mine 10 blocks in hardhat node`, async () => {
    const { baseController } = ctx()
    // Note that,
    // There is a method `hardhat_mine` in doc, but not working now.
    for (let i = 0; i < 10; i++) {
      await baseController.nextBlock()
    }
    const lastestBlock = await baseController.getLatestBlock()
    expect(lastestBlock.number?.toString()).toBe(`10`)
  })

  it(`create forked chain in the container`, async () => {
    const { container, forkController } = ctx()
    
    // start forked hardhat
    const exec = await container.exec({ Cmd: [
      "yarn", "start",
      "--fork", "http://127.0.0.1:8545",
      "--fork-block-number", "5",
      "--port", "8546"
    ] })
    await exec.start({})
    await sleep(15000)
    
    // check current block
    const lastestBlock = await forkController!.getLatestBlock()
    expect(lastestBlock.number?.toString()).toBe(`5`)
  }, 100000)

  it(`reset forked chain to 4th block`, async () => {
    const { forkController } = ctx()

    let lastestBlock = await forkController!.getLatestBlock()
    const previousBlockHash = lastestBlock.parentHash.toString()

    // reset hardhat node to parent block
    const result = await forkController!.resetFork(4)
    expect(result).toBe(true)

    // check parent block hash
    lastestBlock = await forkController!.getLatestBlock()
    expect(lastestBlock.hash?.toString()).toBe(previousBlockHash)
  }, 100000)
})
