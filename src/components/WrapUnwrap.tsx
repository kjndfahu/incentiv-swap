'use client'

import { useState } from 'react'
import {
  useAccount,
  useBalance,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { parseUnits, Address } from 'viem'
import { TOKENS, UNISWAP_V3_CONTRACTS } from '@/config/chains'

const WCENT_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
] as const

export function WrapUnwrap() {
  const { address, isConnected } = useAccount()
  const [mode, setMode] = useState<'wrap' | 'unwrap'>('wrap')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  })

  const { data: nativeBalance } = useBalance({
    address,
  })

  // Try both 'token' and 'tokenAddress' for ERC20, fallback to native if not supported
  const { data: wccentBalance } = useBalance({
    address,
    // @ts-ignore: wagmi v1+ uses 'token', older uses 'tokenAddress'. If neither, only native supported.
    token: TOKENS.WCENT.address as Address,
  })

  const currentBalance = mode === 'wrap' ? nativeBalance : wccentBalance
  const currentBalanceFormatted = currentBalance ? (Number(currentBalance.value) / 10 ** currentBalance.decimals).toString() : '0'

  const handleMaxClick = () => {
    setAmount(currentBalanceFormatted)
  }

  const handleWrap = async () => {
    if (!address || !amount) {
      setError('Please enter an amount')
      return
    }

    setError('')
    setSuccess('')

    try {
      const amountWei = parseUnits(amount, 18)

      writeContract({
        address: TOKENS.WCENT.address as Address,
        abi: WCENT_ABI,
        functionName: 'deposit',
        value: amountWei,
      })
    } catch (err) {
      setError('Failed to initiate wrap transaction')
      console.error(err)
    }
  }

  const handleUnwrap = async () => {
    if (!address || !amount) {
      setError('Please enter an amount')
      return
    }

    setError('')
    setSuccess('')

    try {
      const amountWei = parseUnits(amount, 18)

      writeContract({
        address: TOKENS.WCENT.address as Address,
        abi: WCENT_ABI,
        functionName: 'withdraw',
        args: [amountWei],
      })
    } catch (err) {
      setError('Failed to initiate unwrap transaction')
      console.error(err)
    }
  }

  if (isSuccess && !success) {
    setSuccess(`Successfully ${mode === 'wrap' ? 'wrapped' : 'unwrapped'} ${amount} CENT`)
  }

  const isValidAmount = amount && parseFloat(amount) > 0
  const isAmountExceedBalance = isValidAmount && currentBalance && parseFloat(amount) > parseFloat(currentBalanceFormatted)
  const isButtonDisabled = !isValidAmount || isAmountExceedBalance || isPending || isConfirming

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4 bg-white dark:bg-gray-900 max-w-md">
      <h2 className="text-xl font-bold">Wrap / Unwrap</h2>

      <div className="flex gap-2">
        <button
          onClick={() => {
            setMode('wrap')
            setAmount('')
            setError('')
            setSuccess('')
          }}
          className={`flex-1 py-2 rounded font-semibold transition ${
            mode === 'wrap'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          Wrap CENT
        </button>
        <button
          onClick={() => {
            setMode('unwrap')
            setAmount('')
            setError('')
            setSuccess('')
          }}
          className={`flex-1 py-2 rounded font-semibold transition ${
            mode === 'unwrap'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          Unwrap WCENT
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {mode === 'wrap' ? 'CENT Amount' : 'WCENT Amount'}
          </label>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Balance: {parseFloat(currentBalanceFormatted).toFixed(6)}
          </div>
        </div>

        <div className="relative">
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            value={amount}
            onChange={(e) => {
              const value = e.target.value
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setAmount(value)
                setError('')
              }
            }}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleMaxClick}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            MAX
          </button>
        </div>

        {isAmountExceedBalance && (
          <p className="text-xs text-red-600 dark:text-red-400">
            Insufficient balance
          </p>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-sm text-green-700 dark:text-green-400">
          {success}
        </div>
      )}

      {isConfirming && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-sm text-blue-700 dark:text-blue-400">
          ⏳ Confirming transaction...
        </div>
      )}

      <button
        onClick={mode === 'wrap' ? handleWrap : handleUnwrap}
        disabled={isButtonDisabled}
        className={`w-full py-3 rounded font-semibold transition ${
          isButtonDisabled
            ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {isPending || isConfirming
          ? '⏳ Processing...'
          : mode === 'wrap'
          ? 'Wrap CENT'
          : 'Unwrap WCENT'}
      </button>

      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 pt-2">
        <p>
          {mode === 'wrap'
            ? '✓ Wrap your native CENT to get WCENT for trading'
            : '✓ Convert WCENT back to native CENT'}
        </p>
        <p>✓ No fees for wrapping/unwrapping</p>
      </div>
    </div>
  )
}
