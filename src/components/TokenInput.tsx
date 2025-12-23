'use client'

import { useState } from 'react'

interface Token {
  address: string
  symbol: string
  name: string
  decimals: number
}

interface TokenInputProps {
  label: string
  token: Token
  amount: string
  onAmountChange: (amount: string) => void
  onTokenChange: (token: Token) => void
  balance?: string
  tokens: Token[]
  disabled?: boolean
  allowTokenSelect?: boolean
}

export function TokenInput({
  label,
  token,
  amount,
  onAmountChange,
  onTokenChange,
  balance,
  tokens,
  disabled = false,
  allowTokenSelect = true,
}: TokenInputProps) {
  const [showTokenList, setShowTokenList] = useState(false)

  const handleMax = () => {
    if (balance) {
      onAmountChange(balance)
    }
  }

  return (
    <div className="relative">
      <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm text-zinc-600 dark:text-zinc-400">
            {label}
          </label>
          {balance && !disabled && (
            <button
              onClick={handleMax}
              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Max: {parseFloat(balance).toFixed(6)}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            inputMode="decimal"
            placeholder={disabled ? "0.0" : "0.0"}
            value={amount || ''}
            onChange={(e) => {
              const value = e.target.value
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                onAmountChange(value)
              }
            }}
            disabled={disabled}
            className="flex-1 bg-transparent text-2xl font-semibold text-black dark:text-white outline-none disabled:opacity-50"
            readOnly={disabled}
          />

          <div className="relative">
            <button
              onClick={() => (!disabled || allowTokenSelect) && setShowTokenList(!showTokenList)}
              disabled={disabled && !allowTokenSelect}
              className="flex items-center gap-2 bg-white dark:bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              <span className="font-semibold text-black dark:text-white">
                {token.symbol}
              </span>
              {!disabled && (
                <svg
                  className="w-4 h-4 text-zinc-600 dark:text-zinc-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              )}
            </button>

            {showTokenList && (!disabled || allowTokenSelect) && (
              <div className="absolute right-0 top-full mt-2 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 max-h-64 overflow-y-auto z-20 min-w-[200px]">
                {tokens.map((t) => (
                  <button
                    key={t.address}
                    onClick={() => {
                      onTokenChange(t)
                      setShowTokenList(false)
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-black dark:text-white">
                        {t.symbol}
                      </div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-400">
                        {t.name}
                      </div>
                    </div>
                    {token.address === t.address && (
                      <svg
                        className="w-5 h-5 text-blue-600 dark:text-blue-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showTokenList && (!disabled || allowTokenSelect) && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowTokenList(false)}
        />
      )}
    </div>
  )
}

