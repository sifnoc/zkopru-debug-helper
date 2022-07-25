import fs from 'fs'
import path from 'path'
import Docker, { Container } from 'dockerode'

import { schema } from '../zkopru/packages/database'
import { SQLiteConnector } from '../zkopru/packages/database/dist/node'

const ImageName = process.env.DOCKER_IMAGE_NAME ?? 'zkopru-debug/hardhat'
const ImageTag = process.env.DOCKER_IMAGE_TAG ?? 'latest'

const docker = new Docker({ socketPath: '/var/run/docker.sock' })
const targetImage = `${ImageName}:${ImageTag}`
const targetContainer = process.env.NAME ?? 'zkopru-debug-hardhat'

export async function checkHardhatImage(): Promise<boolean> {
  // For checking zkopru-debug/hardhat image exist
  const imageList = await docker.listImages()
  const flattenImageList = imageList.map(img => img.RepoTags).flat()

  if (flattenImageList.find(img => img?.startsWith(targetImage))) {
    return true
  } else {
    return false
  }
}

export async function getContainers(targetName: string | RegExp) {
  const containerlist = await docker.listContainers({ all: true })
  for (const container of containerlist) {
    if (container.Names.includes("/" + targetName)) {
      return container.Id
    }
  }
  return
}

export async function removeContainer(Id: string) {
  const container = docker.getContainer(Id)
  const containerStatus = await container.inspect()
  if (containerStatus.State.Status != 'exited') {
    await container.kill()
  }
  await container.remove()
}

export async function runForkedChain(url?: string, blockNumber?: number, chainId?: number, override?: any): Promise<Container> {
  const Env: string[] = []

  Env.push(`URL=${url}`)
  if (blockNumber) {
    Env.push(`BLOCK_NUMBER=${blockNumber}`)
  }
  if (chainId) {
    Env.push(`CHAINID=${chainId}`)
  }

  const hardhatContainer = await docker.createContainer({
    Image: targetImage,
    name: targetContainer,
    Env,
    HostConfig: {
      PortBindings: {
        "8545/tcp": [{ HostPort: "8545" }]
      }
    },
    ExposedPorts: { "8545/tcp": {} }
    , ...override
  })

  return hardhatContainer
}

interface dbLatestStatus {
  LatestProposal: number
  LatestMassDeposit: number
  LatestDeposit: number
  LatestSlash: number
}

// this method can get latest blockNumber in tables of database
// for reducing download data from L1 node
export async function getLatestStatus(fileName: string): Promise<dbLatestStatus> {
  // Layer1 blockNumber in database
  // 1. proposal - proposedAt
  // 2. MassDeposit - blockNumber
  // 3. Deposit - blockNumber
  // 4. Slash - slashedAt

  const db = await SQLiteConnector.create(schema, fileName)
  const latestProposal = await db.findOne('Proposal', {
    where: {},
    orderBy: { proposalNum: 'desc' },
    include: { block: true },
  })
  const latestMassDeposit = await db.findOne('MassDeposit', {
    where: {},
    orderBy: { blockNumber: 'desc' }
  })
  const LatestDeposit = await db.findOne('Deposit', {
    where: {},
    orderBy: { blockNumber: 'desc' }
  })
  const LatestSlash = await db.findOne('Slash', {
    where: {},
    orderBy: { slashedAt: 'desc' }
  })

  return {
    LatestProposal: latestProposal.proposedAt as number,
    LatestMassDeposit: latestMassDeposit.blockNumber as number,
    LatestDeposit: LatestDeposit.blockNumber as number,
    LatestSlash: LatestSlash.slashedAt as number
  }
}

export async function getCacheDbFile(blockNumber: number, customPath?: any) {
  // get database files from path
  let dbPath: string
  if (customPath && path.isAbsolute(customPath)) {
    dbPath = path.join(__dirname, customPath)
  } else {
    dbPath = path.join(__dirname, '../dbfiles/')
  }
  const allFiles = fs.readdirSync(dbPath, { encoding: 'utf8' })
  const databaseFiles = allFiles.reduce((dbFile, fileName) => {
    if (fileName.endsWith('sqlite')) { dbFile.push(fileName)}
    return dbFile
  }, [] as string[])
  
  // select database file which most closest synced from 'blockNumber'
  let cloestFile: string = ''
  let lowestBoundary = Infinity
  for (const dbFile of databaseFiles) {
    const status = await getLatestStatus(path.join(dbPath, dbFile))
    const diff = blockNumber - Math.max(...Object.values(status))
    if (diff > 0 && diff <= lowestBoundary) {
      lowestBoundary = diff
      cloestFile = dbFile
    }
  }
  
  if (cloestFile == '') throw Error(`not suitable database file as base`)
  return path.join(dbPath, cloestFile)
}
