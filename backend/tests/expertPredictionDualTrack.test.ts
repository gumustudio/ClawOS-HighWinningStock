/**
 * v1.33.0 阶段 D 测试：次日收益校准（三轨：持仓 pnl + 次日 + 5 日）
 *
 * 覆盖：
 *  1. backfill5dResults: 基于今日 signals 正确计算 T-5 预测的 5d 相对收益，标注 wasCorrect5d
 *  2. backfill5dResults: 幂等——已回填的条目不会被重复处理
 *  3. updateExpertPredictionStats: 累加 1d / 5d 到专家 winRate1d / winRate5d
 *  4. updateExpertPredictionStats: 游标防重复累加（第二次调用同一 tradeDate 统计不变）
 *  5. updateExpertPredictionStats: 未回填的 entry 不参与统计
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import {
  saveExpertDailyMemories,
  readExpertDailyMemories,
  saveStockAnalysisSignals,
  readStockAnalysisExpertPerformance,
  saveStockAnalysisExpertPerformance,
} from '../src/services/stock-analysis/store'
import { _testing as memTesting } from '../src/services/stock-analysis/memory'
import { updateExpertPredictionStats } from '../src/services/stock-analysis/service'
import { getRecentTradeDates } from '../src/services/stock-analysis/trading-calendar'
import type {
  ExpertDailyMemoryEntry,
  StockAnalysisSignal,
  StockAnalysisExpertPerformanceData,
  StockAnalysisExpertPerformanceEntry,
} from '../src/services/stock-analysis/types'

const { backfill5dResults } = memTesting

// ---- 工具 ----

async function makeTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'clawos-dualtrack-'))
}

/**
 * 选择一个基准 today，保证 getRecentTradeDates(today, 7) 返回 ≥6 个交易日。
 * 用固定的 2026 年中的一个周五（规避节假日/周末边界），具体按 calendar 推算。
 */
function pickStableToday(): { today: string; tMinus5: string } {
  // 2026-04-17 是周五。取 today=2026-04-24（周五）或 2026-05-15。
  const today = '2026-04-24'
  const recent = getRecentTradeDates(today, 7)
  if (recent.length < 6 || recent[0] !== today) {
    throw new Error(`pickStableToday: ${today} 无法作为基准交易日，recent=${JSON.stringify(recent)}`)
  }
  return { today, tMinus5: recent[5] }
}

function minimalSignal(code: string, latestPrice: number, tradeDate: string): StockAnalysisSignal {
  return {
    id: `signal-${code}-${tradeDate}`,
    tradeDate,
    code,
    name: code,
    latestPrice,
    sector: 'test',
  } as unknown as StockAnalysisSignal
}

function minimalMemEntry(
  expertId: string,
  code: string,
  tradeDate: string,
  verdict: 'bullish' | 'bearish' | 'neutral',
  overrides: Partial<ExpertDailyMemoryEntry> = {},
): ExpertDailyMemoryEntry {
  return {
    tradeDate,
    expertId,
    code,
    name: code,
    verdict,
    confidence: 60,
    reason: 'test',
    actualReturnNextDay: null,
    wasCorrect: null,
    ...overrides,
  }
}

function minimalPerfEntry(expertId: string): StockAnalysisExpertPerformanceEntry {
  return {
    expertId,
    expertName: expertId,
    layer: 'technical_lead' as StockAnalysisExpertPerformanceEntry['layer'],
    predictionCount: 0,
    correctCount: 0,
    winRate: 0,
    averageConfidence: 0,
    calibration: 0,
    weight: 1,
    lastPredictionDate: '',
    recentOutcomes: [],
  }
}

// ==================== backfill5dResults ====================

test('backfill5dResults: bullish 预测 + T→T+5 上涨 → wasCorrect5d=true, actualReturn5d 精确', async () => {
  const dir = await makeTmpDir()
  const { today, tMinus5 } = pickStableToday()

  // T-5 signals: 基准价 100
  await saveStockAnalysisSignals(dir, tMinus5, [minimalSignal('600000', 100, tMinus5)])
  // today signals: 105 → +5%
  const todaySignals = [minimalSignal('600000', 105, today)]

  // T-5 memory：bullish 预测
  await saveExpertDailyMemories(dir, tMinus5, [
    minimalMemEntry('expert_a', '600000', tMinus5, 'bullish'),
  ])

  await backfill5dResults(dir, today, todaySignals)

  const entries = await readExpertDailyMemories(dir, tMinus5)
  assert.equal(entries.length, 1)
  assert.ok(entries[0].actualReturn5d !== null && entries[0].actualReturn5d !== undefined)
  assert.ok(Math.abs(entries[0].actualReturn5d! - 5) < 1e-6, `5d 收益应≈5%，实际=${entries[0].actualReturn5d}`)
  assert.equal(entries[0].wasCorrect5d, true, 'bullish + 涨 5% → correct')
})

test('backfill5dResults: neutral 预测 + |return|<0.5% → wasCorrect5d=true', async () => {
  const dir = await makeTmpDir()
  const { today, tMinus5 } = pickStableToday()

  await saveStockAnalysisSignals(dir, tMinus5, [minimalSignal('600001', 100, tMinus5)])
  const todaySignals = [minimalSignal('600001', 100.3, today)] // +0.3%

  await saveExpertDailyMemories(dir, tMinus5, [
    minimalMemEntry('expert_b', '600001', tMinus5, 'neutral'),
  ])

  await backfill5dResults(dir, today, todaySignals)
  const entries = await readExpertDailyMemories(dir, tMinus5)
  assert.equal(entries[0].wasCorrect5d, true, 'neutral + |0.3%|<0.5% → correct')
})

test('backfill5dResults: bearish 预测 + T→T+5 上涨 → wasCorrect5d=false', async () => {
  const dir = await makeTmpDir()
  const { today, tMinus5 } = pickStableToday()

  await saveStockAnalysisSignals(dir, tMinus5, [minimalSignal('600002', 100, tMinus5)])
  const todaySignals = [minimalSignal('600002', 108, today)]

  await saveExpertDailyMemories(dir, tMinus5, [
    minimalMemEntry('expert_c', '600002', tMinus5, 'bearish'),
  ])

  await backfill5dResults(dir, today, todaySignals)
  const entries = await readExpertDailyMemories(dir, tMinus5)
  assert.equal(entries[0].wasCorrect5d, false)
  assert.ok(Math.abs(entries[0].actualReturn5d! - 8) < 1e-6)
})

test('backfill5dResults: 已回填的条目保持原值（幂等）', async () => {
  const dir = await makeTmpDir()
  const { today, tMinus5 } = pickStableToday()

  await saveStockAnalysisSignals(dir, tMinus5, [minimalSignal('600003', 100, tMinus5)])
  const todaySignals = [minimalSignal('600003', 120, today)]

  // 预先塞入“已回填”的值（模拟先前的错误结果），确认不会被覆盖
  await saveExpertDailyMemories(dir, tMinus5, [
    minimalMemEntry('expert_d', '600003', tMinus5, 'bullish', {
      actualReturn5d: 99.99, // 异常值
      wasCorrect5d: false,
    }),
  ])

  await backfill5dResults(dir, today, todaySignals)
  const entries = await readExpertDailyMemories(dir, tMinus5)
  // 原值保留
  assert.equal(entries[0].actualReturn5d, 99.99)
  assert.equal(entries[0].wasCorrect5d, false)
})

// ==================== updateExpertPredictionStats ====================

test('updateExpertPredictionStats: 累加 1d 和 5d 结果到专家 winRate', async () => {
  const dir = await makeTmpDir()
  const { today } = pickStableToday()
  const recent = getRecentTradeDates(today, 7)
  const d1 = recent[1] // T-1
  const d2 = recent[2] // T-2

  // 预置专家表现（initial 状态）
  const perf: StockAnalysisExpertPerformanceData = {
    updatedAt: new Date().toISOString(),
    entries: [minimalPerfEntry('expert_x')],
  }
  await saveStockAnalysisExpertPerformance(dir, perf)

  // 在 T-1 和 T-2 分别写入已回填的 memory entries
  await saveExpertDailyMemories(dir, d1, [
    minimalMemEntry('expert_x', '600000', d1, 'bullish', {
      actualReturnNextDay: 2,
      wasCorrect: true,
      actualReturn5d: 3,
      wasCorrect5d: true,
    }),
  ])
  await saveExpertDailyMemories(dir, d2, [
    minimalMemEntry('expert_x', '600000', d2, 'bullish', {
      actualReturnNextDay: -1,
      wasCorrect: false,
      actualReturn5d: -2,
      wasCorrect5d: false,
    }),
  ])

  await updateExpertPredictionStats(dir, today)

  const result = await readStockAnalysisExpertPerformance(dir)
  const x = result.entries.find((e) => e.expertId === 'expert_x')!
  assert.equal(x.predictionCount1d, 2, '1d 应累加 2 条')
  assert.equal(x.correctCount1d, 1)
  assert.equal(x.winRate1d, 0.5)
  assert.equal(x.predictionCount5d, 2)
  assert.equal(x.correctCount5d, 1)
  assert.equal(x.winRate5d, 0.5)
  assert.equal(x.predictionStatsUpdatedAt, today)
})

test('updateExpertPredictionStats: 游标防重复累加，第二次调用数字不变', async () => {
  const dir = await makeTmpDir()
  const { today } = pickStableToday()
  const recent = getRecentTradeDates(today, 7)
  const d1 = recent[1]

  await saveStockAnalysisExpertPerformance(dir, {
    updatedAt: new Date().toISOString(),
    entries: [minimalPerfEntry('expert_y')],
  })
  await saveExpertDailyMemories(dir, d1, [
    minimalMemEntry('expert_y', '600000', d1, 'bullish', {
      actualReturnNextDay: 2,
      wasCorrect: true,
      actualReturn5d: 3,
      wasCorrect5d: true,
    }),
  ])

  await updateExpertPredictionStats(dir, today)
  await updateExpertPredictionStats(dir, today) // 第二次

  const result = await readStockAnalysisExpertPerformance(dir)
  const y = result.entries.find((e) => e.expertId === 'expert_y')!
  assert.equal(y.predictionCount1d, 1, '两次调用后仍只累加 1 条')
  assert.equal(y.predictionCount5d, 1)
})

test('updateExpertPredictionStats: 未回填的 entry 不参与统计', async () => {
  const dir = await makeTmpDir()
  const { today } = pickStableToday()
  const recent = getRecentTradeDates(today, 7)
  const d1 = recent[1]

  await saveStockAnalysisExpertPerformance(dir, {
    updatedAt: new Date().toISOString(),
    entries: [minimalPerfEntry('expert_z')],
  })
  await saveExpertDailyMemories(dir, d1, [
    minimalMemEntry('expert_z', '600000', d1, 'bullish', {
      // 全部 null（未回填）
      actualReturnNextDay: null,
      wasCorrect: null,
    }),
  ])

  await updateExpertPredictionStats(dir, today)

  const result = await readStockAnalysisExpertPerformance(dir)
  const z = result.entries.find((e) => e.expertId === 'expert_z')!
  assert.ok(!z.predictionCount1d || z.predictionCount1d === 0)
  assert.ok(!z.predictionCount5d || z.predictionCount5d === 0)
  // 游标也不应推进
  assert.ok(z.predictionStatsUpdatedAt === undefined)
})
