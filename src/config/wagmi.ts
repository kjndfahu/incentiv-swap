import { createConfig, http } from '@wagmi/core'
import { injected } from 'wagmi/connectors'
import { incentivChain } from './chains'

export const wagmiConfig = createConfig({
  chains: [incentivChain],
  connectors: [
    injected(),
  ],
  transports: {
    [incentivChain.id]: http('https://rpc.incentiv.io'),
  },
  ssr: true,
})

