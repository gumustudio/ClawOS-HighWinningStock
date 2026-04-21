import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { runDailyMemoryUpdate, _testing as memTesting } from '../src/services/stock-analysis/memory'
import {
  readExpertDailyMemories,
  readStockAnalysisExpertPerformance,
  saveStockAnalysisSignals,
} from '../src/services/stock-analysis/store'
import type { StockAnalysisSignal } from '../src/services/stock-analysis/types'

const { settleTradeDateResults } = memTesting

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
}) {
  const verdict = params.verdict ?? 'bullish'
  const confidence = params.confidence ?? 72
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
      votes: [
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
      ],
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
