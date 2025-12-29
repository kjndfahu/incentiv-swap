'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useChainId,
  useSwitchChain,
  useWriteContract,
  useChainId as useCurrentChainId,
} from 'wagmi'
import { Address, parseUnits, formatUnits, erc20Abi } from 'viem'
import { TOKENS, POOLS, UNISWAP_V3_CONTRACTS } from '@/config/chains'

const INCENTIV_CHAIN_ID = 24101
const Q96 = BigInt('79228162514264337593543950336')

const POOL_ABI = [
  {
    name: 'slot0',
    inputs: [],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'observationIndex', type: 'uint16' },
      { name: 'observationCardinality', type: 'uint16' },
      { name: 'observationCardinalityNext', type: 'uint16' },
      { name: 'feeProtocol', type: 'uint8' },
      { name: 'unlocked', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const

const SWAP_ROUTER_ABI = [
  {
    name: 'exactInputSingle',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'deadline', type: 'uint256' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
] as const

const TOKEN_USD_PRICES: Record<string, number> = {
  WCENT: 0.00015,
  WETH: 3500,
  USDC: 1,
  USDT: 1,
  DAI: 1,
}

function getAmountOutFromSqrtPriceX96(
  amountIn: string,
  sqrtPriceX96: bigint,
  tokenInDecimals: number,
  tokenOutDecimals: number,
  invert: boolean
) {
  if (!amountIn || Number(amountIn) <= 0) return ''

  const amountInWei = parseUnits(amountIn, tokenInDecimals)
  let amountOutWei: bigint

  if (!invert) {
    amountOutWei = (amountInWei * sqrtPriceX96 * sqrtPriceX96) / Q96 / Q96
  } else {
    amountOutWei = (amountInWei * Q96 * Q96) / (sqrtPriceX96 * sqrtPriceX96)
  }

  return formatUnits(amountOutWei, tokenOutDecimals)
}

type TokenType = {
  address: string
  symbol: string
  name: string
  decimals: number
}

export function SwapInterface() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()
  const { chains, switchChain } = useSwitchChain()
  const { writeContract, isPending } = useWriteContract()

  const [showConnectModal, setShowConnectModal] = useState(false)
  const [showTokenSelectModal, setShowTokenSelectModal] = useState(false)
  const [selectingTokenFor, setSelectingTokenFor] = useState<'in' | 'out'>('in')
  const [slippage, setSlippage] = useState(0.5)
  const [showSettings, setShowSettings] = useState(false)

  const [tokenIn, setTokenIn] = useState<TokenType>(TOKENS.WCENT as TokenType)
  const [tokenOut, setTokenOut] = useState<TokenType>(TOKENS.WETH as TokenType)
  const [amountIn, setAmountIn] = useState('')
  const [amountOut, setAmountOut] = useState('')
  const [loading, setLoading] = useState(false)

  const { data: balanceInRaw } = useReadContract({
    address: tokenIn.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && tokenIn.address !== '0x0000000000000000000000000000000000000000',
    },
  })

  const { data: balanceOutRaw } = useReadContract({
    address: tokenOut.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && tokenOut.address !== '0x0000000000000000000000000000000000000000',
    },
  })

  const balanceIn = balanceInRaw ? formatUnits(balanceInRaw as bigint, tokenIn.decimals) : '0'
  const balanceOut = balanceOutRaw ? formatUnits(balanceOutRaw as bigint, tokenOut.decimals) : '0'

  const poolInfo = useMemo(() => {
    const forward = `${tokenIn.symbol}/${tokenOut.symbol}`
    const reverse = `${tokenOut.symbol}/${tokenIn.symbol}`

    if ((POOLS as any)[forward]) return { type: 'single' as const, address: (POOLS as any)[forward], invert: false }
    if ((POOLS as any)[reverse]) return { type: 'single' as const, address: (POOLS as any)[reverse], invert: true }

    const mid = 'WCENT'
    const aFwd = `${tokenIn.symbol}/${mid}`
    const aRev = `${mid}/${tokenIn.symbol}`
    const bFwd = `${mid}/${tokenOut.symbol}`
    const bRev = `${tokenOut.symbol}/${mid}`

    const poolAAddr = (POOLS as any)[aFwd] ?? (POOLS as any)[aRev]
    const poolAInvert = !!(POOLS as any)[aRev]
    const poolBAddr = (POOLS as any)[bFwd] ?? (POOLS as any)[bRev]
    const poolBInvert = !!(POOLS as any)[bRev]

    if (poolAAddr && poolBAddr) {
      return {
        type: 'multi' as const,
        poolA: { address: poolAAddr, invert: poolAInvert },
        poolB: { address: poolBAddr, invert: poolBInvert },
      }
    }

    return null
  }, [tokenIn.symbol, tokenOut.symbol])

  const { data: slot0 } = useReadContract({
    address: poolInfo?.type === 'single' ? (poolInfo.address as `0x${string}`) : undefined,
    abi: POOL_ABI,
    functionName: 'slot0',
    query: {
      enabled: !!poolInfo && poolInfo.type === 'single',
      refetchInterval: 5_000,
    },
  })

  const { data: slot0A } = useReadContract({
    address: poolInfo?.type === 'multi' ? (poolInfo.poolA.address as `0x${string}`) : undefined,
    abi: POOL_ABI,
    functionName: 'slot0',
    query: {
      enabled: !!poolInfo && poolInfo.type === 'multi',
      refetchInterval: 5_000,
    },
  })

  const { data: slot0B } = useReadContract({
    address: poolInfo?.type === 'multi' ? (poolInfo.poolB.address as `0x${string}`) : undefined,
    abi: POOL_ABI,
    functionName: 'slot0',
    query: {
      enabled: !!poolInfo && poolInfo.type === 'multi',
      refetchInterval: 5_000,
    },
  })

  const { data: token0Balance } = useReadContract({
    address: tokenIn.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: poolInfo?.type === 'single' ? [poolInfo.address as `0x${string}`] : undefined,
    query: {
      enabled: !!poolInfo && poolInfo.type === 'single',
      refetchInterval: 10_000,
    },
  })

  const { data: token1Balance } = useReadContract({
    address: tokenOut.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: poolInfo?.type === 'single' ? [poolInfo.address as `0x${string}`] : undefined,
    query: {
      enabled: !!poolInfo && poolInfo.type === 'single',
      refetchInterval: 10_000,
    },
  })

  useEffect(() => {
    if (!amountIn || !poolInfo) {
      setAmountOut('')
      return
    }

    try {
      setLoading(true)

      if (poolInfo.type === 'single') {
        if (!slot0) {
          setAmountOut('')
          return
        }

        const sqrtPriceX96 = slot0[0] as bigint
        const out = getAmountOutFromSqrtPriceX96(
          amountIn,
          sqrtPriceX96,
          tokenIn.decimals,
          tokenOut.decimals,
          poolInfo.invert
        )

        setAmountOut(out)
      } else {
        if (!slot0A || !slot0B) {
          setAmountOut('')
          return
        }

        const sqrtA = slot0A[0] as bigint
        const sqrtB = slot0B[0] as bigint

        const midAmount = getAmountOutFromSqrtPriceX96(
          amountIn,
          sqrtA,
          tokenIn.decimals,
          TOKENS.WCENT.decimals,
          poolInfo.poolA.invert
        )

        if (!midAmount || Number(midAmount) <= 0) {
          setAmountOut('')
          return
        }

        const out = getAmountOutFromSqrtPriceX96(
          midAmount,
          sqrtB,
          TOKENS.WCENT.decimals,
          tokenOut.decimals,
          poolInfo.poolB.invert
        )

        setAmountOut(out)
      }
    } catch (err) {
      console.error('[QUOTE ERROR]', err)
      setAmountOut('')
    } finally {
      setLoading(false)
    }
  }, [amountIn, slot0, slot0A, slot0B, poolInfo, tokenIn.decimals, tokenOut.decimals])

  const handleSwap = async () => {
    if (!isConnected || !address || !amountIn || !amountOut || !poolInfo) {
      alert('Missing required fields')
      return
    }

    try {
      const amountInWei = parseUnits(amountIn, tokenIn.decimals)
      const amountOutMinWei = parseUnits(
        (parseFloat(amountOut) * (1 - slippage / 100)).toFixed(tokenOut.decimals),
        tokenOut.decimals
      )

      writeContract({
        address: UNISWAP_V3_CONTRACTS.ROUTER as `0x${string}`,
        abi: SWAP_ROUTER_ABI,
        functionName: 'exactInputSingle',
        args: [
          {
            tokenIn: tokenIn.address as `0x${string}`,
            tokenOut: tokenOut.address as `0x${string}`,
            fee: 3000,
            recipient: address,
            deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
            amountIn: amountInWei,
            amountOutMinimum: amountOutMinWei,
            sqrtPriceLimitX96: BigInt(0),
          },
        ],
      })
    } catch (err) {
      console.error('[SWAP ERROR]', err)
      alert('Swap failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  const handleMaxBalance = () => {
    setAmountIn(balanceIn)
  }

  const switchTokens = () => {
    setTokenIn(tokenOut)
    setTokenOut(tokenIn)
    setAmountIn(amountOut)
    setAmountOut(amountIn)
  }

  const openTokenSelect = (type: 'in' | 'out') => {
    setSelectingTokenFor(type)
    setShowTokenSelectModal(true)
  }

  const selectToken = (token: TokenType) => {
    if (selectingTokenFor === 'in') {
      if (token.symbol === tokenOut.symbol) {
        setTokenOut(tokenIn)
      }
      setTokenIn(token)
    } else {
      if (token.symbol === tokenIn.symbol) {
        setTokenIn(tokenOut)
      }
      setTokenOut(token)
    }
    setAmountIn('')
    setAmountOut('')
    setShowTokenSelectModal(false)
  }

  const amountInUSD = amountIn && TOKEN_USD_PRICES[tokenIn.symbol]
    ? (parseFloat(amountIn) * TOKEN_USD_PRICES[tokenIn.symbol]).toFixed(2)
    : '0.00'

  const amountOutUSD = amountOut && TOKEN_USD_PRICES[tokenOut.symbol]
    ? (parseFloat(amountOut) * TOKEN_USD_PRICES[tokenOut.symbol]).toFixed(2)
    : '0.00'

  const tvl =
    token0Balance && token1Balance && TOKEN_USD_PRICES[tokenIn.symbol] && TOKEN_USD_PRICES[tokenOut.symbol]
      ? (
          parseFloat(formatUnits(token0Balance as bigint, tokenIn.decimals)) * TOKEN_USD_PRICES[tokenIn.symbol] +
          parseFloat(formatUnits(token1Balance as bigint, tokenOut.decimals)) * TOKEN_USD_PRICES[tokenOut.symbol]
        ).toFixed(0)
      : null

  const priceImpact = amountIn && amountOut && parseFloat(amountInUSD) > 0
    ? Math.abs((parseFloat(amountInUSD) - parseFloat(amountOutUSD)) / parseFloat(amountInUSD) * 100).toFixed(2)
    : '0.00'

  if (chainId !== INCENTIV_CHAIN_ID) {
    const targetChain = chains.find((c) => c.id === INCENTIV_CHAIN_ID)
    return (
      <div className="max-w-md mx-auto">
        <button
          onClick={() => switchChain({ chainId: INCENTIV_CHAIN_ID })}
          className="w-full bg-pink-500 hover:bg-pink-600 text-white py-3 rounded-2xl font-semibold"
        >
          Switch to {targetChain?.name || 'Incentiv'}
        </button>
      </div>
    )
  }

  const tokensList = Object.values(TOKENS) as TokenType[]

  return (
    <div className="max-w-md mx-auto">
      
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Swap</h1>
        <div className="flex gap-2">
          {isConnected ? (
            <button
              onClick={() => disconnect()}
              className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition font-medium text-sm"
            >
              {address?.slice(0, 6)}…{address?.slice(-4)}
            </button>
          ) : (
            <button
              onClick={() => setShowConnectModal(true)}
              className="px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white transition font-medium text-sm"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>

      
      {showSettings && (
        <div className="mb-4 p-4 border border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-900">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Slippage tolerance</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">{slippage}%</span>
          </div>
          <div className="flex gap-2">
            {[0.1, 0.5, 1.0].map((val) => (
              <button
                key={val}
                onClick={() => setSlippage(val)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
                  slippage === val
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {val}%
              </button>
            ))}
          </div>
        </div>
      )}

      
      {tvl && (
        <div className="mb-4 p-3 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 rounded-2xl">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Pool TVL</span>
            <span className="text-lg font-bold text-pink-600 dark:text-pink-400">
              ${parseInt(tvl).toLocaleString()}
            </span>
          </div>
        </div>
      )}

     
      <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-4 bg-white dark:bg-gray-900">
        
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl mb-1">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">You pay</span>
            {isConnected && (
              <button
                onClick={handleMaxBalance}
                className="text-sm text-pink-500 hover:text-pink-600 font-medium"
              >
                Balance: {parseFloat(balanceIn).toFixed(4)}
              </button>
            )}
          </div>
          <div className="flex justify-between items-center gap-2">
            <input
              type="text"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="0.0"
              className="flex-1 bg-transparent text-3xl font-semibold outline-none"
            />
            <button
              onClick={() => openTokenSelect('in')}
              className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 rounded-xl font-semibold hover:bg-gray-100 dark:hover:bg-gray-600 transition"
            >
              {tokenIn.symbol}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">≈ ${amountInUSD}</div>
        </div>

        
        <div className="flex justify-center -my-2 relative z-10">
          <button
            onClick={switchTokens}
            className="p-2 bg-gray-100 dark:bg-gray-800 border-4 border-white dark:border-gray-900 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </div>

        
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl mt-1">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">You receive</span>
            {isConnected && (
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Balance: {parseFloat(balanceOut).toFixed(4)}
              </span>
            )}
          </div>
          <div className="flex justify-between items-center gap-2">
            <div className="flex-1 text-3xl font-semibold">{loading ? '...' : amountOut || '0.0'}</div>
            <button
              onClick={() => openTokenSelect('out')}
              className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 rounded-xl font-semibold hover:bg-gray-100 dark:hover:bg-gray-600 transition"
            >
              {tokenOut.symbol}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">≈ ${amountOutUSD}</div>
          {amountIn && amountOut && (
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Price Impact: ~{priceImpact}%
            </div>
          )}
        </div>

       
        <button
          onClick={handleSwap}
          disabled={!isConnected || !amountIn || !amountOut || isPending || loading}
          className="w-full mt-4 bg-pink-500 hover:bg-pink-600 text-white font-bold py-4 rounded-2xl transition disabled:opacity-50 disabled:cursor-not-allowed text-lg"
        >
          {!isConnected ? 'Connect Wallet' : isPending ? 'Swapping...' : 'Swap'}
        </button>
      </div>

      
      {showTokenSelectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowTokenSelectModal(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-sm z-50 border border-gray-200 dark:border-gray-700 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Select a token</h3>
              <button
                onClick={() => setShowTokenSelectModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-2">
              {tokensList.map((token) => (
                <button
                  key={token.symbol}
                  onClick={() => selectToken(token)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <div className="font-semibold">{token.symbol}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{token.name}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowConnectModal(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-sm z-50 border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Connect Wallet</h3>
              <button
                onClick={() => setShowConnectModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3">
              {connectors.map((connector) => (
                <button
                  key={connector.id}
                  onClick={() => {
                    connect({ connector })
                    setShowConnectModal(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition font-medium"
                >
                  {connector.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}