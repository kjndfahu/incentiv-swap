"use client"

import { SwapInterface } from "@/components/SwapInterface";
import {useState} from "react";
import {AddLiquidity} from "@/components/AddLiquidity";
import {RemoveLiquidity} from "@/components/RemoveLiquidity";
import {WrapUnwrap} from "@/components/WrapUnwrap";

export default function Home() {
  const [tab, setTab] = useState<'swap' | 'liquidity' | 'wrap'>('swap')
  return (
      <div className="min-h-screen bg-white dark:bg-gray-950">
        <div className="border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 bg-white dark:bg-gray-950">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex gap-2">
              <button 
                onClick={() => setTab('swap')}
                className={`px-6 py-2.5 rounded font-semibold transition ${
                  tab === 'swap' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Swap
              </button>
              <button 
                onClick={() => setTab('wrap')}
                className={`px-6 py-2.5 rounded font-semibold transition ${
                  tab === 'wrap' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Wrap
              </button>
              <button 
                onClick={() => setTab('liquidity')}
                className={`px-6 py-2.5 rounded font-semibold transition ${
                  tab === 'liquidity' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Liquidity
              </button>
            </div>
          </div>
        </div>

       
        <div className="max-w-4xl mx-auto px-4 py-8">
          {tab === 'swap' && <SwapInterface />}
          {tab === 'wrap' && <WrapUnwrap />}
          {tab === 'liquidity' && (
              <div className="space-y-6">
                  <AddLiquidity />
                  <RemoveLiquidity />
              </div>
          )}
        </div>
      </div>
  )
}
