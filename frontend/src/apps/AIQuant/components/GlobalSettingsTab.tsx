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
  const [intradayAutoCloseProfitPercent, setIntradayAutoCloseProfitPercent] = useState('10')
  const [maxDailyLossPercent, setMaxDailyLossPercent] = useState('10')
  const [maxWeeklyLossPercent, setMaxWeeklyLossPercent] = useState('20')
  const [maxMonthlyLossPercent, setMaxMonthlyLossPercent] = useState('30')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!config) return
    setIntradayAutoCloseLossPercent(String(config.intradayAutoCloseLossPercent))
    setIntradayAutoCloseProfitPercent(String(config.intradayAutoCloseProfitPercent ?? 10))
    setMaxDailyLossPercent(String(config.portfolioRiskLimits?.maxDailyLossPercent ?? 10))
    setMaxWeeklyLossPercent(String(config.portfolioRiskLimits?.maxWeeklyLossPercent ?? 20))
    setMaxMonthlyLossPercent(String(config.portfolioRiskLimits?.maxMonthlyLossPercent ?? 30))
  }, [config])

  async function handleSave() {
    const parsedIntraday = Number(intradayAutoCloseLossPercent)
    const parsedIntradayProfit = Number(intradayAutoCloseProfitPercent)
    const parsedDaily = Number(maxDailyLossPercent)
    const parsedWeekly = Number(maxWeeklyLossPercent)
    const parsedMonthly = Number(maxMonthlyLossPercent)
    if (!Number.isFinite(parsedIntraday) || parsedIntraday <= 0 || parsedIntraday > 100) {
      onToast('error', '盘中自动平仓亏损阈值必须在 0 到 100 之间')
      return
    }
    if (!Number.isFinite(parsedIntradayProfit) || parsedIntradayProfit <= 0 || parsedIntradayProfit > 100) {
      onToast('error', '盘中自动止盈阈值必须在 0 到 100 之间')
      return
    }
    if (!Number.isFinite(parsedDaily) || parsedDaily <= 0 || parsedDaily > 100) {
      onToast('error', '日度亏损暂停阈值必须在 0 到 100 之间')
      return
    }
    if (!Number.isFinite(parsedWeekly) || parsedWeekly <= 0 || parsedWeekly > 100) {
      onToast('error', '周度亏损暂停阈值必须在 0 到 100 之间')
      return
    }
    if (!Number.isFinite(parsedMonthly) || parsedMonthly <= 0 || parsedMonthly > 100) {
      onToast('error', '月度亏损暂停阈值必须在 0 到 100 之间')
      return
    }
    setSaving(true)
    try {
      const nextConfig = await saveStockAnalysisConfig({
        intradayAutoCloseLossPercent: parsedIntraday,
        intradayAutoCloseProfitPercent: parsedIntradayProfit,
        portfolioRiskLimits: {
          maxDailyLossPercent: parsedDaily,
          maxWeeklyLossPercent: parsedWeekly,
          maxMonthlyLossPercent: parsedMonthly,
        },
      })
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
              仅在交易日连续竞价时段生效。持仓实时亏损或盈利达到阈值时，系统会在盯盘轮询中自动全平仓卖出。
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold tracking-wide text-slate-500">自动止损阈值 (%)</label>
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

          <div>
            <label className="block text-xs font-semibold tracking-wide text-slate-500">自动止盈阈值 (%)</label>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                value={intradayAutoCloseProfitPercent}
                onChange={(event) => setIntradayAutoCloseProfitPercent(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <span className="text-sm font-semibold text-slate-500">%</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600 md:col-span-2">
            <div className="font-semibold text-slate-800">当前说明</div>
            <div className="mt-2 leading-6">
              当持仓盘中亏损小于等于 <span className="font-bold text-red-600">-{intradayAutoCloseLossPercent || '0'}%</span>，或盈利大于等于 <span className="font-bold text-emerald-600">+{intradayAutoCloseProfitPercent || '0'}%</span> 时，系统将自动执行全部平仓。
              午休、收盘后、周末与法定休市日不会触发自动卖出。
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4 border-t border-slate-100 pt-5">
          <p className="text-xs text-slate-400">这两个阈值都属于“盯盘期间自动强制退出”规则，和信号页的展示型止损/止盈价不同。</p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-rose-600 p-2 text-white">
            <Cog6ToothIcon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-slate-900">组合亏损暂停阈值</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              这些阈值控制组合级新开仓限制。达到阈值后，系统会暂停新增风险，但仍允许你平仓或减仓退出风险。默认值分别为日度 10%、周度 20%、月度 30%。
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold tracking-wide text-slate-500">日度亏损暂停阈值 (%)</label>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                value={maxDailyLossPercent}
                onChange={(event) => setMaxDailyLossPercent(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <span className="text-sm font-semibold text-slate-500">%</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold tracking-wide text-slate-500">周度亏损暂停阈值 (%)</label>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                value={maxWeeklyLossPercent}
                onChange={(event) => setMaxWeeklyLossPercent(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <span className="text-sm font-semibold text-slate-500">%</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold tracking-wide text-slate-500">月度亏损暂停阈值 (%)</label>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                value={maxMonthlyLossPercent}
                onChange={(event) => setMaxMonthlyLossPercent(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <span className="text-sm font-semibold text-slate-500">%</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
            <div className="font-semibold text-slate-800">当前说明</div>
            <div className="mt-2 leading-6">
              当近 22 个交易日累计已实现亏损小于等于 <span className="font-bold text-rose-600">-{maxMonthlyLossPercent || '0'}%</span> 时，系统暂停新开仓。
              已有持仓仍允许你手动平仓或减仓退出风险；保存后会立即重算当前暂停状态。
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600 md:col-span-3">
            <div className="font-semibold text-slate-800">当前说明</div>
            <div className="mt-2 leading-6">
              日度达到 <span className="font-bold text-rose-600">-{maxDailyLossPercent || '0'}%</span>、周度达到 <span className="font-bold text-rose-600">-{maxWeeklyLossPercent || '0'}%</span>、月度达到 <span className="font-bold text-rose-600">-{maxMonthlyLossPercent || '0'}%</span> 时，会暂停新开仓。
              保存后会立即重算当前风控状态；已有持仓仍允许手动平仓或减仓。
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4 border-t border-slate-100 pt-5">
          <p className="text-xs text-slate-400">“盘中自动平仓”管单票快速止损；“日/周/月亏损暂停”管组合级开仓闸门。两者职责不同，不要混用。</p>
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
