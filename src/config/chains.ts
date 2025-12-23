import { defineChain } from 'viem'

export const incentivChain = defineChain({
  id: 24101,
  name: 'Incentiv',
  nativeCurrency: {
    name: 'CENT',
    symbol: 'CENT',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.incentiv.io'],
    },
    public: {
      http: ['https://rpc.incentiv.io', 'https://rpc-archive.incentiv.io'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Incentiv Explorer',
      url: 'https://explorer.incentiv.io',
    },
  },
})

export const UNISWAP_V3_CONTRACTS = {
  FACTORY: '0x766A315502B1f9869C0E2A19aEA6D6f55b0ad108',
  ROUTER: '0x4a66A8bA9704DD06fE52A027f2B16a3F5D11B048',
  POSITION_MANAGER: '0x800f7a6028EED5EA0e89a7C3799e13B5DE4f1D28',
  QUOTER_V3: '0x1d317fFfBc3Bda5aA06F9f8f506e8C6082dC415A',
  WCENT: '0xB0f0A14A50F14dc9e6476d61C00cF0375Dd4EB04',
} as const

export const TOKENS = {
  WCENT: {
    address: '0xB0f0A14A50F14dc9e6476d61C00cF0375Dd4EB04',
    symbol: 'WCENT',
    name: 'Wrapped CENT',
    decimals: 18,
  },
  CENT: {
    address: '0x0000000000000000000000000000000000000000',
    symbol: 'CENT',
    name: 'CENT (native)',
    decimals: 18,
  },
  WETH: {
    address: '0x3e425317dB7BaC8077093117081b40d9b46F29cb',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
  },
  USDC: {
    address: '0x16e43840d8D79896A389a3De85aB0B0210C05685',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
  USDT: {
    address: '0x39b076b5d23F588690D480af3Bf820edad31a4bB',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
  },
  SOL: {
    address: '0xfaC24134dbc4b00Ee11114eCDFE6397f389203E3',
    symbol: 'SOL',
    name: 'Solana',
    decimals: 18,
  },
  MEME: {
    address: '0x409338f33939a8CEE41F0aFA3019e3ACF47C8256',
    symbol: 'MEME',
    name: 'Meme Token',
    decimals: 18,
  },
} as const


export const POOLS = {
  'WETH/WCENT': '0xCC00489ECd4B60141DAb86c6aa44e7697c6923E6',
  'USDC/WCENT': '0xf9884c2A1749b0a02ce780aDE437cBaDFA3a961D',
  'USDT/WCENT': '0xd1da5c73eB5b498Dea4224267FEeA3A3dE82BA4E',
  'SOL/WCENT': '0x40D6b92323493adB118EFB945D26c8bf09d37B9A',
  'MEME/WCENT': '0xb58d75D42B80C79B4835F6a040E9f4578193AD78',
} as const




