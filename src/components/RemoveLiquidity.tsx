'use client'

import { useEffect, useState } from 'react'
import {
    useAccount,
    useReadContract,
    useWriteContract,
} from 'wagmi'
import { Address } from 'viem'
import { UNISWAP_V3_CONTRACTS, TOKENS } from '@/config/chains'


const POSITION_MANAGER_ABI = [
    {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'owner', type: 'address' }],
        outputs: [{ type: 'uint256' }],
    },
    {
        name: 'tokenOfOwnerByIndex',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'index', type: 'uint256' },
        ],
        outputs: [{ type: 'uint256' }],
    },
    {
        name: 'positions',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        outputs: [
            { name: 'nonce', type: 'uint96' },
            { name: 'operator', type: 'address' },
            { name: 'token0', type: 'address' },
            { name: 'token1', type: 'address' },
            { name: 'fee', type: 'uint24' },
            { name: 'tickLower', type: 'int24' },
            { name: 'tickUpper', type: 'int24' },
            { name: 'liquidity', type: 'uint128' },
            { name: 'feeGrowthInside0LastX128', type: 'uint256' },
            { name: 'feeGrowthInside1LastX128', type: 'uint256' },
            { name: 'tokensOwed0', type: 'uint128' },
            { name: 'tokensOwed1', type: 'uint128' },
        ],
    },
    {
        name: 'decreaseLiquidity',
        type: 'function',
        inputs: [
            {
                name: 'params',
                type: 'tuple',
                components: [
                    { name: 'tokenId', type: 'uint256' },
                    { name: 'liquidity', type: 'uint128' },
                    { name: 'amount0Min', type: 'uint256' },
                    { name: 'amount1Min', type: 'uint256' },
                    { name: 'deadline', type: 'uint256' },
                ],
            },
        ],
    },
    {
        name: 'collect',
        type: 'function',
        inputs: [
            {
                name: 'params',
                type: 'tuple',
                components: [
                    { name: 'tokenId', type: 'uint256' },
                    { name: 'recipient', type: 'address' },
                    { name: 'amount0Max', type: 'uint128' },
                    { name: 'amount1Max', type: 'uint128' },
                ],
            },
        ],
    },
    {
        name: 'burn',
        type: 'function',
        inputs: [{ name: 'tokenId', type: 'uint256' }],
    },
] as const


export function RemoveLiquidity() {
    const { address } = useAccount()
    const { writeContract } = useWriteContract()

    const [tokenIds, setTokenIds] = useState<bigint[]>([])


    const { data: balance } = useReadContract({
        address: UNISWAP_V3_CONTRACTS.POSITION_MANAGER as Address,
        abi: POSITION_MANAGER_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
    })


    useEffect(() => {
        if (!balance || !address) return

        const load = async () => {
            const ids: bigint[] = []
            const bal = typeof balance === 'bigint' ? Number(balance) : Number(balance || 0);
            for (let i = 0; i < bal; i++) {
                // Type guard for window.ethereum
                const eth = (window as any).ethereum;
                if (!eth) continue;
                const tokenId = await eth.request({
                    method: 'eth_call',
                    params: [{
                        to: UNISWAP_V3_CONTRACTS.POSITION_MANAGER,
                        data: undefined,
                    }],
                })
                ids.push(tokenId)
            }
            setTokenIds(ids)
        }

        load()
    }, [balance, address])


    const withdrawAll = async (tokenId: bigint, liquidity: bigint) => {
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200)

        await writeContract({
            address: UNISWAP_V3_CONTRACTS.POSITION_MANAGER as Address,
            abi: POSITION_MANAGER_ABI,
            functionName: 'decreaseLiquidity',
            args: [{
                tokenId,
                liquidity,
                amount0Min: BigInt(0),
                amount1Min: BigInt(0),
                deadline,
            }],
        })

        await writeContract({
            address: UNISWAP_V3_CONTRACTS.POSITION_MANAGER as Address,
            abi: POSITION_MANAGER_ABI,
            functionName: 'collect',
            args: [{
                tokenId,
                recipient: address!,
                amount0Max: BigInt('340282366920938463463374607431768211455'), // 2**128 - 1
                amount1Max: BigInt('340282366920938463463374607431768211455'),
            }],
        })

        await writeContract({
            address: UNISWAP_V3_CONTRACTS.POSITION_MANAGER as Address,
            abi: POSITION_MANAGER_ABI,
            functionName: 'burn',
            args: [tokenId],
        })
    }

    if (!balance || balance === BigInt(0)) {
        return (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center bg-white dark:bg-gray-900">
            <p className="text-gray-500 dark:text-gray-400">No liquidity positions yet</p>
          </div>
        )
    }

    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4 bg-white dark:bg-gray-900">
            <h2 className="text-xl font-bold">Your Liquidity Positions</h2>

            <div className="space-y-3">
              {tokenIds.map((id) => (
                  <PositionRow
                      key={id.toString()}
                      tokenId={id}
                      onWithdraw={withdrawAll}
                  />
              ))}
            </div>
        </div>
    )
}


function PositionRow({
                         tokenId,
                         onWithdraw,
                     }: {
    tokenId: bigint
    onWithdraw: (id: bigint, liquidity: bigint) => void
}) {
    const { data } = useReadContract({
        address: UNISWAP_V3_CONTRACTS.POSITION_MANAGER as Address,
        abi: POSITION_MANAGER_ABI,
        functionName: 'positions',
        args: [tokenId],
    })

    if (!data) return null

    // Cast data to array for index access
    const arr = data as unknown as any[];
    const token0 = Object.values(TOKENS).find(t => t.address === arr[2])
    const token1 = Object.values(TOKENS).find(t => t.address === arr[3])

    return (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="space-y-2 mb-3">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  NFT #{tokenId.toString()}
              </div>
              <div className="text-gray-600 dark:text-gray-400 text-sm">
                  {token0?.symbol}/{token1?.symbol} • Full Range
              </div>
            </div>
            <button
                onClick={() => onWithdraw(tokenId, arr[7])}
                className="w-full bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded transition font-medium text-sm"
            >
                Remove Liquidity (100%)
            </button>
        </div>
    )
}
