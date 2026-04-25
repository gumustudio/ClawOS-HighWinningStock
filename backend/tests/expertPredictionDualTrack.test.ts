import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { rebuildExpertPerformanceFromSignals, runDailyMemoryUpdate, _testing as memTesting } from '../src/services/stock-analysis/memory'
import {
  readExpertDailyMemories,
  readStockAnalysisExpertPerformance,
  saveStockAnalysisSignals,
} from '../src/services/stock-analysis/store'
import type { StockAnalysisSignal } from '../src/services/stock-analysis/types'

const { extractMemoryEntriesFromSignals, settleTradeDateResults, buildExpertPerformanceFromSettledEntries } = memTesting

async function makeTmpDir(): Promise<{ tempRoot: string; dir: string }> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'clawos-daily-close-settlement-'))
  return {
    tempRoot,
    dir: path.join(tempRoot, 'AI炒股分析'),
  }
}

function buildSignal(params: {
  code: string
  tradeDate: string
  snapshotChangePercent: number
  realtimeChangePercent?: number
  verdict?: 'bullish' | 'bearish' | 'neutral'
  confidence?: number
  votes?: Array<Partial<StockAnalysisSignal['expert']['votes'][number]>>
}) {
  const verdict = params.verdict ?? 'bullish'
  const confidence = params.confidence ?? 72
  const votes = params.votes ?? [
    {
      expertId: 'expert-a',
      expertName: '专家A',
      layer: 'market_trading',
      stance: 'neutral',
      verdict,
      confidence,
      reason: 'test',
      modelId: 'glm-5',
      providerId: 'zhipu',
      providerName: 'ZHIPU',
      usedFallback: false,
      latencyMs: 100,
    },
  ]
  return {
    id: `signal-${params.code}-${params.tradeDate}`,
    tradeDate: params.tradeDate,
    code: params.code,
    name: params.code,
    latestPrice: 100,
    sector: 'test',
    snapshot: {
      changePercent: params.snapshotChangePercent,
    },
    realtime: params.realtimeChangePercent === undefined ? null : {
      latestPrice: 101,
      changePercent: params.realtimeChangePercent,
      open: 100,
      high: 102,
      low: 99,
      previousClose: 100,
      fetchedAt: `${params.tradeDate}T15:00:00.000Z`,
    },
    expert: {
      votes,
    },
  } as unknown as StockAnalysisSignal
}

test('settleTradeDateResults 优先使用当日 realtime 收盘涨跌幅，而不是旧 snapshot', async () => {
  const { tempRoot, dir } = await makeTmpDir()
  try {
    const tradeDate = '2026-04-22'
    const signals = [buildSignal({ code: '600000', tradeDate, snapshotChangePercent: -2.5, realtimeChangePercent: 3.2 })]
    const entries = signals[0].expert.votes.map((vote) => ({
      tradeDate,
      expertId: vote.expertId,
      expertName: vote.expertName,
      layer: vote.layer,
      code: signals[0].code,
      name: signals[0].name,
      verdict: vote.verdict,
      confidence: vote.confidence,
      reason: vote.reason,
      actualReturnNextDay: null,
      wasCorrect: null,
    }))

    const settled = await settleTradeDateResults(dir, entries, signals)

    assert.equal(settled[0].actualReturnNextDay, 3.2)
    assert.equal(settled[0].wasCorrect, true)
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true })
  }
})

test('runDailyMemoryUpdate 会在盘后当天把预测结算写入 daily-memories 和 expert-performance', async () => {
  const { tempRoot, dir } = await makeTmpDir()
  try {
    const tradeDate = '2026-04-22'
    const signals = [buildSignal({ code: '600001', tradeDate, snapshotChangePercent: 0.4, realtimeChangePercent: -1.6, verdict: 'bearish', confidence: 68 })]
    await saveStockAnalysisSignals(dir, tradeDate, signals)

    await runDailyMemoryUpdate(dir, tradeDate, {
      version: 1,
      updatedAt: '',
      providers: [],
      experts: [],
      layerAssignments: [],
      extractionAgents: [],
    })

    const dailyMemories = await readExpertDailyMemories(dir, tradeDate)
    const expertPerformance = await readStockAnalysisExpertPerformance(dir)

    assert.equal(dailyMemories.length, 1)
    assert.equal(dailyMemories[0].actualReturnNextDay, -1.6)
    assert.equal(dailyMemories[0].wasCorrect, true)

    assert.equal(expertPerformance.entries.length, 1)
    assert.equal(expertPerformance.entries[0].predictionCount, 1)
    assert.equal(expertPerformance.entries[0].correctCount, 1)
    assert.equal(expertPerformance.entries[0].winRate, 1)
    assert.equal(expertPerformance.entries[0].recentOutcomes[0].source, 'daily_close')
    assert.equal(expertPerformance.entries[0].recentOutcomes[0].actualReturnPercent, -1.6)
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true })
  }
})

test('runDailyMemoryUpdate 重复执行同一 tradeDate 不会重复累加 expert-performance', async () => {
  const { tempRoot, dir } = await makeTmpDir()
  try {
    const tradeDate = '2026-04-22'
    const signals = [buildSignal({ code: '600002', tradeDate, snapshotChangePercent: 1.1, realtimeChangePercent: 1.1 })]
    await saveStockAnalysisSignals(dir, tradeDate, signals)

    const emptyConfig = {
      version: 1,
      updatedAt: '',
      providers: [],
      experts: [],
      layerAssignments: [],
      extractionAgents: [],
    }

    await runDailyMemoryUpdate(dir, tradeDate, emptyConfig)
    await runDailyMemoryUpdate(dir, tradeDate, emptyConfig)

    const expertPerformance = await readStockAnalysisExpertPerformance(dir)
    assert.equal(expertPerformance.entries.length, 1)
    assert.equal(expertPerformance.entries[0].predictionCount, 1)
    assert.equal(expertPerformance.entries[0].recentOutcomes.length, 1)
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true })
  }
})

test('extractMemoryEntriesFromSignals 会保留规则专家和 fallback 投票的模型字段', async () => {
  const tradeDate = '2026-04-22'
  const signals = [buildSignal({
    code: '600003',
    tradeDate,
    snapshotChangePercent: 0.2,
    votes: [
      {
        expertId: 'rule-momentum',
        expertName: '规则动量',
        layer: 'rule_functions',
        verdict: 'bullish',
        confidence: 61,
        reason: 'rule',
        modelId: 'rule-engine',
      },
      {
        expertId: 'expert-fallback',
        expertName: 'Fallback 专家',
        layer: 'market_trading',
        verdict: 'bearish',
        confidence: 66,
        reason: 'fallback',
        modelId: 'kimi-for-coding',
        providerId: 'kimi',
        providerName: 'Kimi',
        assignedModelId: 'glm-5.1',
        usedFallback: true,
      },
    ],
  })]

  const entries = extractMemoryEntriesFromSignals(signals, tradeDate)

  assert.equal(entries.length, 2)
  assert.equal(entries[0].modelId, 'rule-engine')
  assert.equal(entries[1].modelId, 'kimi-for-coding')
  assert.equal(entries[1].providerId, 'kimi')
  assert.equal(entries[1].assignedModelId, 'glm-5.1')
  assert.equal(entries[1].usedFallback, true)
})

test('runDailyMemoryUpdate 会把规则专家和 fallback 投票同步进 expert-performance', async () => {
  const { tempRoot, dir } = await makeTmpDir()
  try {
    const tradeDate = '2026-04-22'
    const signals = [buildSignal({
      code: '600004',
      tradeDate,
      snapshotChangePercent: -1.2,
      realtimeChangePercent: -1.2,
      votes: [
        {
          expertId: 'rule-risk',
          expertName: '规则风险',
          layer: 'rule_functions',
          verdict: 'bearish',
          confidence: 70,
          reason: 'rule',
          modelId: 'rule-engine',
        },
        {
          expertId: 'expert-kimi-fallback',
          expertName: 'Kimi Fallback',
          layer: 'market_trading',
          verdict: 'bearish',
          confidence: 69,
          reason: 'fallback',
          modelId: 'kimi-for-coding',
          providerId: 'kimi',
          providerName: 'Kimi',
          assignedModelId: 'glm-5.1',
          usedFallback: true,
        },
      ],
    })]
    await saveStockAnalysisSignals(dir, tradeDate, signals)

    await runDailyMemoryUpdate(dir, tradeDate, {
      version: 1,
      updatedAt: '',
      providers: [],
      experts: [],
      layerAssignments: [],
      extractionAgents: [],
    })

    const expertPerformance = await readStockAnalysisExpertPerformance(dir)
    const ruleEntry = expertPerformance.entries.find((entry) => entry.expertId === 'rule-risk')
    const fallbackEntry = expertPerformance.entries.find((entry) => entry.expertId === 'expert-kimi-fallback')

    assert.ok(ruleEntry)
    assert.equal(ruleEntry.recentOutcomes[0].modelId, 'rule-engine')
    assert.equal(ruleEntry.winRate, 1)
    assert.ok(fallbackEntry)
    assert.equal(fallbackEntry.recentOutcomes[0].modelId, 'kimi-for-coding')
    assert.equal(fallbackEntry.recentOutcomes[0].providerId, 'kimi')
    assert.equal(fallbackEntry.recentOutcomes[0].assignedModelId, 'glm-5.1')
    assert.equal(fallbackEntry.recentOutcomes[0].usedFallback, true)
    assert.equal(fallbackEntry.winRate, 1)
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true })
  }
})

test('buildExpertPerformanceFromSettledEntries 重建时保持最新 outcome 在前', async () => {
  const rebuilt = buildExpertPerformanceFromSettledEntries([
    {
      tradeDate: '2026-04-22',
      expertId: 'expert-order',
      expertName: '顺序专家',
      layer: 'market_trading',
      code: '600005',
      name: 'A',
      verdict: 'bullish',
      confidence: 60,
      reason: 'old',
      modelId: 'glm-5.1',
      providerId: 'opencodego',
      providerName: 'OpenCodeGo',
      actualReturnNextDay: 1,
      wasCorrect: true,
    },
    {
      tradeDate: '2026-04-24',
      expertId: 'expert-order',
      expertName: '顺序专家',
      layer: 'market_trading',
      code: '600006',
      name: 'B',
      verdict: 'bearish',
      confidence: 70,
      reason: 'new',
      modelId: 'glm-5.1',
      providerId: 'opencodego',
      providerName: 'OpenCodeGo',
      actualReturnNextDay: -1,
      wasCorrect: true,
    },
  ])

  assert.equal(rebuilt.entries[0].recentOutcomes[0].tradeDate, '2026-04-24')
  assert.equal(rebuilt.entries[0].lastPredictionDate, '2026-04-24')
})

test('rebuildExpertPerformanceFromSignals 会从历史 signals 回填规则和 fallback 表现', async () => {
  const { tempRoot, dir } = await makeTmpDir()
  try {
    const tradeDate = '2026-04-22'
    await saveStockAnalysisSignals(dir, tradeDate, [buildSignal({
      code: '600007',
      tradeDate,
      snapshotChangePercent: 1.4,
      realtimeChangePercent: 1.4,
      votes: [
        {
          expertId: 'rule-rebuild',
          expertName: '规则重建',
          layer: 'rule_functions',
          verdict: 'bullish',
          confidence: 64,
          reason: 'rule',
          modelId: 'rule-engine',
        },
        {
          expertId: 'expert-opencodego',
          expertName: 'OpenCodeGo 专家',
          layer: 'market_trading',
          verdict: 'bullish',
          confidence: 72,
          reason: 'llm',
          modelId: 'glm-5.1',
          providerId: 'opencodego',
          providerName: 'OpenCodeGo',
        },
      ],
    })])

    const rebuilt = await rebuildExpertPerformanceFromSignals(dir)

    assert.equal(rebuilt.entries.length, 2)
    assert.ok(rebuilt.entries.some((entry) => entry.expertId === 'rule-rebuild' && entry.winRate === 1))
    const opencodego = rebuilt.entries.find((entry) => entry.expertId === 'expert-opencodego')
    assert.ok(opencodego)
    assert.equal(opencodego.recentOutcomes[0].modelId, 'glm-5.1')
    assert.equal(opencodego.recentOutcomes[0].providerId, 'opencodego')
    assert.equal(opencodego.winRate, 1)
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true })
  }
})
