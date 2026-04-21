import { useEffect, useState } from 'react'
import { Cog6ToothIcon } from '@heroicons/react/24/outline'

import { saveStockAnalysisConfig } from '../api'
import type { StockAnalysisStrategyConfig } from '../types'

export function GlobalSettingsTab({
  config,
  actionLoading,
  onConfigSaved,
  onToast,
}: {
  config: StockAnalysisStrategyConfig | null
  actionLoading: boolean
  onConfigSaved: (config: StockAnalysisStrategyConfig) => void
  onToast: (tone: 'success' | 'error', message: string) => void
}) {
  const [intradayAutoCloseLossPercent, setIntradayAutoCloseLossPercent] = useState('5')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!config) return
    setIntradayAutoCloseLossPercent(String(config.intradayAutoCloseLossPercent))
  }, [config])

  async function handleSave() {
    const parsed = Number(intradayAutoCloseLossPercent)
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) {
      onToast('error', '盘中自动平仓亏损阈值必须在 0 到 100 之间')
      return
    }
    setSaving(true)
    try {
      const nextConfig = await saveStockAnalysisConfig({ intradayAutoCloseLossPercent: parsed })
      onConfigSaved(nextConfig)
      onToast('success', '全局设置已保存')
    } catch (error) {
      onToast('error', `保存全局设置失败: ${(error as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5 pb-16">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">全局设置</h2>
          <p className="mt-1 text-sm text-slate-500">配置 AI 炒股全局行为。此页用于放不属于单个信号或单个模型的系统级参数。</p>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-xs text-indigo-700">
          当前生效后端配置
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-slate-900 p-2 text-white">
            <Cog6ToothIcon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-slate-900">盘中自动平仓</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              仅在交易日连续竞价时段生效。持仓实时亏损超过该阈值时，系统会在盯盘轮询中自动全平仓卖出。
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,280px)_1fr]">
          <div>
            <label className="block text-xs font-semibold tracking-wide text-slate-500">亏损阈值 (%)</label>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                value={intradayAutoCloseLossPercent}
                onChange={(event) => setIntradayAutoCloseLossPercent(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <span className="text-sm font-semibold text-slate-500">%</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
            <div className="font-semibold text-slate-800">当前说明</div>
            <div className="mt-2 leading-6">
              当持仓盘中亏损小于等于 <span className="font-bold text-red-600">-{intradayAutoCloseLossPercent || '0'}%</span> 时，系统将自动执行全部平仓。
              午休、收盘后、周末与法定休市日不会触发自动卖出。
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4 border-t border-slate-100 pt-5">
          <p className="text-xs text-slate-400">建议与普通止损线区分使用。这个阈值针对“盯盘期间自动强制退出”，不是信号页的展示型止损价。</p>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || actionLoading || !config}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存设置'}
          </button>
        </div>
      </section>
    </div>
  )
}
