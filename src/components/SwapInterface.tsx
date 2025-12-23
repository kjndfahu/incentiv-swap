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
} from 'wagmi'
import { Address, parseUnits, formatUnits } from 'viem'
import { TOKENS, POOLS, UNISWAP_V3_CONTRACTS } from '@/config/chains'
import { TokenInput } from './TokenInput'


const INCENTIV_CHAIN_ID = 24101
const Q96 = BigInt('79228162514264337593543950336') // 2**96


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
    amountOutWei =
        (amountInWei * sqrtPriceX96 * sqrtPriceX96) /
        Q96 /
        Q96
  } else {
    amountOutWei =
        (amountInWei * Q96 * Q96) /
        (sqrtPriceX96 * sqrtPriceX96)
  }

  return formatUnits(amountOutWei, tokenOutDecimals)
}


export function SwapInterface() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()
  const { chains, switchChain } = useSwitchChain()
  const { writeContract, isPending } = useWriteContract()

  const [showConnectModal, setShowConnectModal] = useState(false)

  type TokenType = { address: string; symbol: string; name: string; decimals: number }

  const [tokenIn, setTokenIn] = useState<TokenType>(TOKENS.WCENT as unknown as TokenType)
  const [tokenOut, setTokenOut] = useState<TokenType>(TOKENS.WETH as unknown as TokenType)
  const [amountIn, setAmountIn] = useState('')
  const [amountOut, setAmountOut] = useState('')
  const [loading, setLoading] = useState(false)


  const poolInfo = useMemo(() => {
    const forward = `${tokenIn.symbol}/${tokenOut.symbol}`
    const reverse = `${tokenOut.symbol}/${tokenIn.symbol}`

    if ((POOLS as any)[forward]) return { type: 'single', address: (POOLS as any)[forward], invert: false }
    if ((POOLS as any)[reverse]) return { type: 'single', address: (POOLS as any)[reverse], invert: true }

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
        type: 'multi',
        poolA: { address: poolAAddr, invert: poolAInvert },
        poolB: { address: poolBAddr, invert: poolBInvert },
      }
    }

    return null
  }, [tokenIn.symbol, tokenOut.symbol])


  const { data: slot0 } = useReadContract({
    address: (poolInfo && poolInfo.type === 'single' ? poolInfo.address : undefined) as Address,
    abi: POOL_ABI,
    functionName: 'slot0',
    query: {
      enabled: !!poolInfo && (poolInfo as any).type === 'single',
      refetchInterval: 5_000,
    },
  })

  const { data: slot0A } = useReadContract({
    address: (poolInfo && (poolInfo as any).type === 'multi' ? (poolInfo as any).poolA.address : undefined) as Address,
    abi: POOL_ABI,
    functionName: 'slot0',
    query: {
      enabled: !!poolInfo && (poolInfo as any).type === 'multi',
      refetchInterval: 5_000,
    },
  })

  const { data: slot0B } = useReadContract({
    address: (poolInfo && (poolInfo as any).type === 'multi' ? (poolInfo as any).poolB.address : undefined) as Address,
    abi: POOL_ABI,
    functionName: 'slot0',
    query: {
      enabled: !!poolInfo && (poolInfo as any).type === 'multi',
      refetchInterval: 5_000,
    },
  })


  useEffect(() => {
    if (!amountIn || !poolInfo) {
      setAmountOut('')
      return
    }

    try {
      setLoading(true)

      if ((poolInfo as any).type === 'single') {
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
            (poolInfo as any).invert
        )

        setAmountOut(out)

        console.log('[POOL QUOTE]', {
          mode: 'single',
          pair: `${tokenIn.symbol}/${tokenOut.symbol}`,
          amountIn,
          sqrtPriceX96: sqrtPriceX96.toString(),
          invert: (poolInfo as any).invert,
          amountOut: out,
        })
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
            (poolInfo as any).poolA.invert
        )

        if (!midAmount) {
          setAmountOut('')
          return
        }

        const out = getAmountOutFromSqrtPriceX96(
            midAmount,
            sqrtB,
            TOKENS.WCENT.decimals,
            tokenOut.decimals,
            (poolInfo as any).poolB.invert
        )

        setAmountOut(out)

        console.log('[POOL QUOTE]', {
          mode: 'multi',
          path: `${tokenIn.symbol}->WCENT->${tokenOut.symbol}`,
          amountIn,
          midAmount,
          amountOut: out,
        })
      }
    } catch (err) {
      console.error('[QUOTE ERROR]', err)
      setAmountOut('')
    } finally {
      setLoading(false)
    }
  }, [
    amountIn,
    slot0,
    poolInfo,
    tokenIn.decimals,
    tokenOut.decimals,
    tokenIn.symbol,
    tokenOut.symbol,
  ])


  const handleSwap = async () => {
    if (!isConnected || !address || !amountIn || !amountOut || !poolInfo) {
      alert('Missing required fields')
      return
    }

    try {
      const amountInWei = parseUnits(amountIn, tokenIn.decimals)
      const amountOutMinWei = parseUnits(
        (parseFloat(amountOut) * 0.99).toString(),
        tokenOut.decimals
      )

      let pool: any = poolInfo
      if ((poolInfo as any).type === 'multi') {
        pool = (poolInfo as any).poolA
      }

      writeContract({
        address: UNISWAP_V3_CONTRACTS.ROUTER as Address,
        abi: SWAP_ROUTER_ABI,
        functionName: 'exactInputSingle',
        args: [
          {
            tokenIn: tokenIn.address as Address,
            tokenOut: tokenOut.address as Address,
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


  if (chainId !== INCENTIV_CHAIN_ID) {
    const targetChain = chains.find(c => c.id === INCENTIV_CHAIN_ID)
    return (
        <button
            onClick={() => switchChain({ chainId: INCENTIV_CHAIN_ID })}
            className="w-full bg-blue-600 text-white py-3 rounded-xl"
        >
          Switch to {targetChain?.name}
        </button>
    )
  }

  return (
      <div className="max-w-md mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Swap</h1>
          {isConnected ? (
            <button
              onClick={() => disconnect()}
              className="text-xs px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              {address?.slice(0, 6)}…{address?.slice(-4)}
            </button>
          ) : (
            <button
              onClick={() => setShowConnectModal(true)}
              className="text-xs px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              Подключить кошелек
            </button>
          )}
        </div>

        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4 bg-white dark:bg-gray-900">
          <TokenInput
              label="From"
              token={tokenIn}
              amount={amountIn}
              onAmountChange={setAmountIn}
              onTokenChange={setTokenIn}
              tokens={Object.values(TOKENS)}
          />

          <div className="flex justify-center py-2">
            <button className="border border-gray-300 dark:border-gray-600 rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4" />
              </svg>
            </button>
          </div>

          <TokenInput
              label="To"
              token={tokenOut}
              amount={loading ? '...' : amountOut}
              onAmountChange={() => {}}
              onTokenChange={setTokenOut}
              tokens={Object.values(TOKENS)}
              disabled
              allowTokenSelect
          />

          <button 
            onClick={handleSwap}
            disabled={!isConnected || !amountIn || !amountOut || isPending}
            className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Swapping...' : 'Execute Swap'}
          </button>
        </div>

      {showConnectModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-40" onClick={() => setShowConnectModal(false)} />
          <div className="relative bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-sm z-50">
            <h3 className="text-lg font-semibold mb-4">Подключить кошелек</h3>
            <div className="space-y-3">
              {connectors.filter(c => c.id !== 'injected').map(connector => (
                <button
                  key={connector.id}
                  onClick={() => {
                    connect({ connector })
                    setShowConnectModal(false)
                  }}
                  className="w-full text-left px-4 py-3 rounded border border-gray-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
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