import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import {
  generateMonthlyReport,
  generateWeeklyReport,
  getStockAnalysisOverview,
  _testing as serviceTesting,
} from '../src/services/stock-analysis/service'
import {
  readMonthlyReports,
  readStockAnalysisPerformanceDashboard,
  saveStockAnalysisExpertPerformance,
  saveExpertDailyMemories,
  saveStockAnalysisModelGroups,
  saveStockAnalysisSignals,
  saveStockAnalysisRuntimeStatus,
} from '../src/services/stock-analysis/store'
import type { StockAnalysisSignal } from '../src/services/stock-analysis/types'

const { buildModelGroupPerformance } = serviceTesting

async function createTempDir(): Promise<{ tempRoot: string; dir: string }> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'clawos-model-groups-reset-'))
  const dir = path.join(tempRoot, 'AI炒股分析')
  await fs.mkdir(dir, { recursive: true })
  return { tempRoot, dir }
}

function buildLegacyModelGroup() {
  return {
    group: 'legacy/glm-5',
    modelId: 'glm-5',
    providerId: 'legacy',
    providerName: 'LegacyProvider',
    displayName: 'glm-5 (LegacyProvider)',
    predictionCount: 128,
    winRate: 0.72,
    averageConfidence: 0.81,
    calibration: 0.67,
    weight: 1.18,
    isSimulated: false,
  }
}

function buildRuntimeStatus() {
  const now = new Date().toISOString()
  return {
    lastRunAt: now,
    lastSuccessAt: now,
    lastError: null,
    stockPoolRefreshedAt: now,
    latestSignalDate: '2026-04-22',
    latestSuccessfulSignalDate: '2026-04-22',
    runState: 'success' as const,
    currentRun: null,
    quoteCacheAt: now,
    indexHistoryCacheAt: now,
    isUsingFallback: false,
    staleReasons: [],
    riskControl: { paused: false, pauseReason: null, pausedAt: null, totalPauses: 0, lastResolvedAt: null },
    postMarketAt: null,
  }
}

function buildSignalWithVotes(): StockAnalysisSignal {
  return {
    id: 'signal-600010-2026-04-22',
    tradeDate: '2026-04-22',
    code: '600010',
    name: '测试股票',
    latestPrice: 10,
    sector: 'test',
    confidence: 70,
    snapshot: { changePercent: 1.2 },
    expert: {
      isSimulated: false,
      votes: [
        {
          expertId: 'expert-kimi',
          expertName: 'Kimi 专家',
          layer: 'market_trading',
          stance: 'neutral',
          verdict: 'bullish',
          confidence: 70,
          reason: 'kimi',
          modelId: 'kimi-for-coding',
          providerId: 'kimi',
          providerName: 'Kimi',
          usedFallback: true,
          latencyMs: 100,
        },
        {
          expertId: 'expert-opencodego',
          expertName: 'OpenCodeGo 专家',
          layer: 'market_trading',
          stance: 'neutral',
          verdict: 'bearish',
          confidence: 80,
          reason: 'opencodego',
          modelId: 'glm-5.1',
          providerId: 'opencodego',
          providerName: 'OpenCodeGo',
          latencyMs: 120,
        },
        {
          expertId: 'rule-risk',
          expertName: '规则风险',
          layer: 'rule_functions',
          stance: 'neutral',
          verdict: 'neutral',
          confidence: 55,
          reason: 'rule',
          modelId: 'rule-engine',
          latencyMs: 1,
        },
      ],
    },
  } as unknown as StockAnalysisSignal
}

test('expert-performance 已清空时，overview 不再返回旧 model-groups 缓存', async () => {
  const { tempRoot, dir } = await createTempDir()
  try {
    await saveStockAnalysisRuntimeStatus(dir, buildRuntimeStatus())
    await saveStockAnalysisModelGroups(dir, [buildLegacyModelGroup()])
    await saveStockAnalysisExpertPerformance(dir, { updatedAt: '', entries: [] })

    const overview = await getStockAnalysisOverview(dir)

    assert.deepEqual(overview.modelGroupPerformance, [])
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true })
  }
})

test('expert-performance 已清空时，周报仪表盘不再使用旧 model-groups 缓存', async () => {
  const { tempRoot, dir } = await createTempDir()
  try {
    await saveStockAnalysisRuntimeStatus(dir, buildRuntimeStatus())
    await saveStockAnalysisModelGroups(dir, [buildLegacyModelGroup()])
    await saveStockAnalysisExpertPerformance(dir, { updatedAt: '', entries: [] })

    await generateWeeklyReport(dir)
    const dashboard = await readStockAnalysisPerformanceDashboard(dir)

    assert.ok(dashboard)
    assert.equal(dashboard.bestModelGroup, null)
    assert.equal(dashboard.worstModelGroup, null)
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true })
  }
})

test('expert-performance 已清空时，月报叙述不再复用旧 model-groups 缓存', async () => {
  const { tempRoot, dir } = await createTempDir()
  try {
    await saveStockAnalysisRuntimeStatus(dir, buildRuntimeStatus())
    await saveStockAnalysisModelGroups(dir, [buildLegacyModelGroup()])
    await saveStockAnalysisExpertPerformance(dir, { updatedAt: '', entries: [] })

    await generateMonthlyReport(dir)
    const reports = await readMonthlyReports(dir)

    assert.equal(reports.length, 1)
    assert.doesNotMatch(reports[0].narrativeSummary, /### 模型组表现/)
    assert.doesNotMatch(reports[0].narrativeSummary, /legacy\/glm-5/)
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true })
  }
})

test('模型组表现按 recentOutcomes 的实际 provider/model 聚合胜率', async () => {
  const { tempRoot, dir } = await createTempDir()
  try {
    await saveStockAnalysisSignals(dir, '2026-04-22', [buildSignalWithVotes()])

    const groups = await buildModelGroupPerformance(dir, {
      updatedAt: '2026-04-22T15:00:00.000Z',
      entries: [
        {
          expertId: 'expert-kimi',
          expertName: 'Kimi 专家',
          layer: 'market_trading',
          predictionCount: 1,
          correctCount: 1,
          winRate: 1,
          averageConfidence: 70,
          calibration: 0.3,
          weight: 1.5,
          lastPredictionDate: '2026-04-22',
          recentOutcomes: [{
            tradeDate: '2026-04-22',
            code: '600010',
            modelId: 'kimi-for-coding',
            providerId: 'kimi',
            providerName: 'Kimi',
            assignedModelId: 'glm-5.1',
            usedFallback: true,
            verdict: 'bullish',
            confidence: 70,
            actualReturnPercent: 1.2,
            correct: true,
            source: 'daily_close',
          }],
        },
        {
          expertId: 'expert-opencodego',
          expertName: 'OpenCodeGo 专家',
          layer: 'market_trading',
          predictionCount: 1,
          correctCount: 0,
          winRate: 0,
          averageConfidence: 80,
          calibration: 0.8,
          weight: 0.7,
          lastPredictionDate: '2026-04-22',
          recentOutcomes: [{
            tradeDate: '2026-04-22',
            code: '600010',
            modelId: 'glm-5.1',
            providerId: 'opencodego',
            providerName: 'OpenCodeGo',
            verdict: 'bearish',
            confidence: 80,
            actualReturnPercent: 1.2,
            correct: false,
            source: 'daily_close',
          }],
        },
        {
          expertId: 'rule-risk',
          expertName: '规则风险',
          layer: 'rule_functions',
          predictionCount: 1,
          correctCount: 0,
          winRate: 0,
          averageConfidence: 55,
          calibration: 0.55,
          weight: 1,
          lastPredictionDate: '2026-04-22',
          recentOutcomes: [{
            tradeDate: '2026-04-22',
            code: '600010',
            modelId: 'rule-engine',
            verdict: 'neutral',
            confidence: 55,
            actualReturnPercent: 1.2,
            correct: false,
            source: 'daily_close',
          }],
        },
      ],
    })

    const kimi = groups.find((group) => group.group === 'kimi/kimi-for-coding')
    const opencodego = groups.find((group) => group.group === 'opencodego/glm-5.1')
    const rules = groups.find((group) => group.group === 'rules')

    assert.ok(kimi)
    assert.equal(kimi.displayName, 'kimi-for-coding (Kimi)')
    assert.equal(kimi.winRate, 1)
    assert.equal(kimi.weight, 1.5)
    assert.ok(opencodego)
    assert.equal(opencodego.displayName, 'glm-5.1 (OpenCodeGo)')
    assert.equal(opencodego.winRate, 0)
    assert.equal(opencodego.weight, 0.7)
    assert.ok(rules)
    assert.equal(rules.winRate, 0)
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true })
  }
})

test('模型组表现优先按完整 daily-memories 聚合，避免 recentOutcomes 截断造成 0%', async () => {
  const { tempRoot, dir } = await createTempDir()
  try {
    await saveStockAnalysisSignals(dir, '2026-04-22', [buildSignalWithVotes()])
    await saveExpertDailyMemories(dir, '2026-04-22', [
      {
        tradeDate: '2026-04-22',
        expertId: 'expert-opencodego',
        expertName: 'OpenCodeGo 专家',
        layer: 'market_trading',
        code: '600010',
        name: '测试股票',
        verdict: 'bullish',
        confidence: 75,
        reason: 'settled daily memory',
        modelId: 'glm-5.1',
        providerId: 'opencodego',
        providerName: 'OpenCodeGo',
        actualReturnNextDay: 1.2,
        wasCorrect: true,
      },
    ])

    const groups = await buildModelGroupPerformance(dir, {
      updatedAt: '2026-04-22T15:00:00.000Z',
      entries: [{
        expertId: 'expert-opencodego',
        expertName: 'OpenCodeGo 专家',
        layer: 'market_trading',
        predictionCount: 51,
        correctCount: 0,
        winRate: 0,
        averageConfidence: 80,
        calibration: 0.8,
        weight: 0.8,
        lastPredictionDate: '2026-04-24',
        recentOutcomes: [],
      }],
    })

    const opencodego = groups.find((group) => group.group === 'opencodego/glm-5.1')
    assert.ok(opencodego)
    assert.equal(opencodego.winRate, 1)
    assert.equal(opencodego.weight, 0.8)
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true })
  }
})
