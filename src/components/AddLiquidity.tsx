'use client'

import { useState } from 'react'
import {
    useAccount,
    useBalance,
    useReadContract,
    useWriteContract,
} from 'wagmi'
import { parseUnits, Address } from 'viem'
import { TOKENS, UNISWAP_V3_CONTRACTS, POOLS } from '@/config/chains'
import { TokenInput } from './TokenInput'

const POSITION_MANAGER_ABI = [
    {
        inputs: [
            {
                components: [
                    { name: 'token0', type: 'address' },
                    { name: 'token1', type: 'address' },
                    { name: 'fee', type: 'uint24' },
                    { name: 'tickLower', type: 'int24' },
                    { name: 'tickUpper', type: 'int24' },
                    { name: 'amount0Desired', type: 'uint256' },
                    { name: 'amount1Desired', type: 'uint256' },
                    { name: 'amount0Min', type: 'uint256' },
                    { name: 'amount1Min', type: 'uint256' },
                    { name: 'recipient', type: 'address' },
                    { name: 'deadline', type: 'uint256' },
                ],
                name: 'params',
                type: 'tuple',
            },
        ],
        name: 'mint',
        outputs: [
            { name: 'tokenId', type: 'uint256' },
            { name: 'liquidity', type: 'uint128' },
            { name: 'amount0', type: 'uint256' },
            { name: 'amount1', type: 'uint256' },
        ],
        stateMutability: 'payable',
        type: 'function',
    },
] as const

const ERC20_ABI = [
    {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
    },
] as const

const FEE = 3000
const MIN_TICK = -887272
const MAX_TICK = 887272

export function AddLiquidity() {
    const { address } = useAccount()
    const { writeContract } = useWriteContract()

    // Use Token type for state
    type Token = (typeof TOKENS)[keyof typeof TOKENS];
    const [token0, setToken0] = useState<Token>(TOKENS.WCENT)
    const [token1, setToken1] = useState<Token>(TOKENS.WETH)
    const [amount0, setAmount0] = useState('')
    const [amount1, setAmount1] = useState('')

    // For native token, omit 'token' (or 'tokenAddress')
    const NATIVE = '0x0000000000000000000000000000000000000000';
    const isToken0Native = token0.address === NATIVE;
    const isToken1Native = token1.address === NATIVE;

    const bal0 = useBalance({
        address,
        ...(isToken0Native ? {} : { token: token0.address as Address })
    }).data;

    const bal1 = useBalance({
        address,
        ...(isToken1Native ? {} : { token: token1.address as Address })
    }).data;

    const approve = async (token: any, amount: string) => {
        // Don't approve for native token
        if (token.address === '0x0000000000000000000000000000000000000000') return;
        writeContract({
            address: token.address as Address,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [
                UNISWAP_V3_CONTRACTS.POSITION_MANAGER as Address,
                parseUnits(amount, token.decimals),
            ],
        });
    };

    const addLiquidity = async () => {
        if (!address) return;

        // Use String(0) for min amounts to avoid BigInt error
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

        writeContract({
            address: UNISWAP_V3_CONTRACTS.POSITION_MANAGER as Address,
            abi: POSITION_MANAGER_ABI,
            functionName: 'mint',
            args: [
                {
                    token0: token0.address as Address,
                    token1: token1.address as Address,
                    fee: FEE,
                    tickLower: MIN_TICK,
                    tickUpper: MAX_TICK,
                    amount0Desired: parseUnits(amount0, token0.decimals),
                    amount1Desired: parseUnits(amount1, token1.decimals),
                    amount0Min: BigInt(0),
                    amount1Min: BigInt(0),
                    recipient: address,
                    deadline,
                },
            ],
        });
    };

    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4 bg-white dark:bg-gray-900">
            <h2 className="text-xl font-bold">Add Liquidity (Full Range)</h2>

            <TokenInput
                label="Token 0"
                token={token0}
                amount={amount0}
                onAmountChange={setAmount0}
                onTokenChange={setToken0 as (token: any) => void}
                balance={bal0 ? (Number(bal0.value) / 10 ** bal0.decimals).toString() : ''}
                tokens={Object.values(TOKENS)}
            />

            <TokenInput
                label="Token 1"
                token={token1}
                amount={amount1}
                onAmountChange={setAmount1}
                onTokenChange={setToken1 as (token: any) => void}
                balance={bal1 ? (Number(bal1.value) / 10 ** bal1.decimals).toString() : ''}
                tokens={Object.values(TOKENS)}
            />

            <div className="space-y-2 pt-2">
              <button
                  onClick={() => approve(token0, amount0)}
                  className="w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white py-2.5 rounded transition font-medium text-sm"
              >
                  Approve {token0.symbol}
              </button>

              <button
                  onClick={() => approve(token1, amount1)}
                  className="w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white py-2.5 rounded transition font-medium text-sm"
              >
                  Approve {token1.symbol}
              </button>

              <button
                  onClick={addLiquidity}
                  className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded font-semibold transition"
              >
                  Add Liquidity
              </button>
            </div>
        </div>
    )
}
