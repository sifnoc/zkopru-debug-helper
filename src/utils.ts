var Docker = require('dockerode')
import { Container } from 'dockerode'

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

export async function runHardhatContainer(Url: string, blockNumber?: number): Promise<Container> {
  const Env: string[] = []
  Env.push(`URL=${Url}`)
  if (blockNumber) {
    Env.push(`BLOCK_NUMBER=${blockNumber}`)
  }

  const hardhatContainer = await docker.createContainer({
    Image: targetImage,
    name: targetContainer,
    Env,
    HostConfig: {
      PortBindings: {
        "8545/tcp": [{ HostPort: "8545" }]
      }
    }
  })
  return hardhatContainer
}
