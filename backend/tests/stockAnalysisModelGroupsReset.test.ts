import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import {
  generateMonthlyReport,
  generateWeeklyReport,
  getStockAnalysisOverview,
} from '../src/services/stock-analysis/service'
import {
  readMonthlyReports,
  readStockAnalysisPerformanceDashboard,
  saveStockAnalysisExpertPerformance,
  saveStockAnalysisModelGroups,
  saveStockAnalysisRuntimeStatus,
} from '../src/services/stock-analysis/store'

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
