/**
 * v1.33.0 阶段 A 测试：
 *   - P0-1：验证「必读核心指标」块（RSI/MACD/ATR/产业强度）注入了 prompt
 *   - P0-2：验证「近 30 日 K 线摘要」注入了 prompt，且结构包含统计概览/早期折叠/近 10 日逐日/形态
 *   - 强制可见性：即便 infoSubset 过滤到只剩最小白名单，必读块和 K 线仍然出现
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { _testing as llmTesting } from '../src/services/stock-analysis/llm-inference'
import type {
  StockAnalysisKlinePoint,
  StockAnalysisMarketState,
  StockAnalysisStockSnapshot,
  StockAnalysisExpertDefinition,
} from '../src/services/stock-analysis/types'

const { buildIndicatorBlock, buildKlineSummary, buildStockContext, buildExpertUserMessage } = llmTesting

// ==================== 辅助函数 ====================

function createSnapshot(overrides?: Partial<StockAnalysisStockSnapshot>): StockAnalysisStockSnapshot {
  return {
    code: '600519',
    name: '贵州茅台',
    market: 'sh',
    exchange: 'SSE',
    sector: '酿酒行业',
    latestPrice: 1800,
    changePercent: 1.5,
    open: 1785,
    high: 1810,
    low: 1782,
    previousClose: 1773,
    turnoverRate: 2.5,
    totalMarketCap: 2_260_000_000_000,
    circulatingMarketCap: 2_260_000_000_000,
    averageTurnoverAmount20d: 5_000_000_000,
    amplitude20d: 3.2,
    declineDays20d: 4,
    return5d: 2.1,
    return20d: 5.8,
    return60d: 12.4,
    return120d: 18.3,
    momentumRank20d: 0.82,
    momentumRank60d: 0.75,
    volumeBreakout: 1.35,
    volatility20d: 0.021,
    volatilityRank: 0.55,
    pricePosition20d: 0.78,
    movingAverage5: 1785,
    movingAverage20: 1750,
    movingAverage60: 1680,
    movingAverage120: 1600,
    movingAverage20Slope: 0.12,
    movingAverage60Slope: 0.08,
    rsi14: 68.5,
    macdLine: 12.34,
    macdSignal: 9.87,
    macdHistogram: 2.47,
    atr14: 35.2,
    atrPercent: 1.95,
    distanceToResistance1: 2.3,
    distanceToSupport1: 4.1,
    industryStrength: 0.78,
    industryBreadth: 0.65,
    industryReturn20d: 6.2,
    industryReturn60d: 14.1,
    industryTrendStrength: 0.81,
    scoreReason: ['动量强', '行业景气'],
    ...overrides,
  }
}

function createMarketState(): StockAnalysisMarketState {
  return {
    asOfDate: '2026-04-19',
    trend: 'bull_trend',
    volatility: 'normal_volatility',
    liquidity: 'normal_liquidity',
    sentiment: 'optimistic',
    style: 'balanced',
    csi500Return20d: 4.5,
    annualizedVolatility20d: 18,
    averageTurnover20d: 200_000_000_000,
    risingRatio: 0.62,
    volatilityPercentile: 0.45,
    volumePercentile: 0.55,
  }
}

function createKlineHistory(days = 60, startPrice = 1700): StockAnalysisKlinePoint[] {
  const points: StockAnalysisKlinePoint[] = []
  let prev = startPrice
  for (let i = 0; i < days; i++) {
    const close = prev * (1 + (Math.sin(i / 3) * 0.02))
    const open = prev
    const high = Math.max(open, close) * 1.012
    const low = Math.min(open, close) * 0.988
    const volume = 1_500_000 + i * 10_000
    const date = new Date(2026, 1, 1 + i)
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    points.push({
      date: dateStr,
      open,
      close,
      high,
      low,
      volume,
      turnover: close * volume,
      amplitude: ((high - low) / open) * 100,
      changePercent: prev === 0 ? 0 : ((close - prev) / prev) * 100,
      changeAmount: close - prev,
      turnoverRate: 2 + (i % 3) * 0.5,
    })
    prev = close
  }
  return points
}

function createExpert(overrides?: Partial<StockAnalysisExpertDefinition>): StockAnalysisExpertDefinition {
  return {
    id: 'test-expert',
    name: '测试专家',
    layer: 'company_fundamentals',
    stance: 'neutral',
    enabled: true,
    weight: 1,
    systemPrompt: '这是系统提示',
    ...overrides,
  } as StockAnalysisExpertDefinition
}

// ==================== buildIndicatorBlock 测试 ====================

test('buildIndicatorBlock: 包含 RSI/MACD/ATR/产业强度字段', () => {
  const snapshot = createSnapshot()
  const lines = buildIndicatorBlock(snapshot)
  const text = lines.join('\n')

  assert.match(text, /RSI14：68\.5/, 'RSI 值应该出现')
  assert.match(text, /MACD.*DIF=12\.340/, 'MACD DIF 应该出现')
  assert.match(text, /ATR14：35\.20/, 'ATR 应该出现')
  assert.match(text, /占价比：1\.95%/, 'ATR 占价比应该出现')
  assert.match(text, /距上方压力/, '支撑压力距离应该出现')
  assert.match(text, /MA20 斜率：0\.120/, 'MA20 斜率应该出现')
  assert.match(text, /产业强度：0\.78/, '产业强度应该出现')
})

test('buildIndicatorBlock: null 字段显示 N/A 而非崩溃', () => {
  const snapshot = createSnapshot({
    rsi14: null,
    macdLine: null,
    macdSignal: null,
    macdHistogram: null,
    atr14: null,
    atrPercent: null,
    distanceToResistance1: null,
    distanceToSupport1: null,
    industryStrength: null,
    industryBreadth: null,
    industryReturn20d: null,
    industryReturn60d: null,
    industryTrendStrength: null,
  })
  const lines = buildIndicatorBlock(snapshot)
  const text = lines.join('\n')

  assert.match(text, /RSI14：N\/A/, 'RSI 为 null 时应输出 N/A')
  assert.match(text, /MACD：DIF=N\/A/, 'MACD 为 null 时应输出 N/A')
  assert.match(text, /ATR14：N\/A/, 'ATR 为 null 时应输出 N/A')
  // 产业强度 null 不应该输出该行
  assert.ok(!text.includes('产业强度'), '产业强度为 null 时该行应被省略')
})

// ==================== buildKlineSummary 测试 ====================

test('buildKlineSummary: 正常 60 日历史 → 输出统计概览/早期折叠/近10日/形态', () => {
  const history = createKlineHistory(60, 1700)
  const lines = buildKlineSummary(history)
  const text = lines.join('\n')

  assert.ok(lines.length > 0, '应该输出摘要行')
  assert.match(text, /区间：.*至.*共 30 根/, '应说明取了 30 根')
  assert.match(text, /均价：/, '应有均价')
  assert.match(text, /最高：/, '应有最高')
  assert.match(text, /区间总涨跌/, '应有区间涨跌')
  assert.match(text, /早期走势/, '应有早期折叠')
  assert.match(text, /近 10 日逐日/, '应有近 10 日简报')
  assert.match(text, /形态特征/, '应有形态特征')
})

test('buildKlineSummary: 空历史或太短 → 返回空', () => {
  assert.equal(buildKlineSummary(undefined).length, 0, 'undefined 应返回空')
  assert.equal(buildKlineSummary([]).length, 0, '空数组应返回空')
  assert.equal(buildKlineSummary(createKlineHistory(3)).length, 0, '少于 5 根应返回空')
})

test('buildKlineSummary: 输出长度在合理范围（token 预算 800-1200 ≈ 1500-2400 字符）', () => {
  const history = createKlineHistory(60)
  const text = buildKlineSummary(history).join('\n')
  assert.ok(text.length > 200, `摘要不应太短，实际 ${text.length}`)
  assert.ok(text.length < 3500, `摘要不应过长，实际 ${text.length}`)
})

// ==================== buildStockContext 强制可见性测试 ====================

test('buildStockContext: 无 infoSubset（全量模式）→ 必读指标和 K 线都出现', () => {
  const snapshot = createSnapshot()
  const marketState = createMarketState()
  const history = createKlineHistory(60)
  const text = buildStockContext(snapshot, marketState, undefined, history)

  assert.match(text, /## 必读核心指标/, '全量模式应出现必读指标块')
  assert.match(text, /RSI14：68\.5/, 'RSI 应在 prompt 中')
  assert.match(text, /## 近 30 日 K 线摘要/, '全量模式应出现 K 线摘要块')
})

test('buildStockContext: 即便 infoSubset 只有 basic → 必读指标和 K 线依然可见', () => {
  const snapshot = createSnapshot()
  const marketState = createMarketState()
  const history = createKlineHistory(60)
  // 模拟最小白名单专家
  const text = buildStockContext(snapshot, marketState, ['basic'], history)

  assert.match(text, /## 必读核心指标/, 'infoSubset=basic 也应出现必读指标块')
  assert.match(text, /## 近 30 日 K 线摘要/, 'infoSubset=basic 也应出现 K 线摘要块')
  assert.match(text, /MACD.*DIF=/, 'MACD 数据应出现')
})

test('buildStockContext: 无 history → 必读指标仍出现，K 线摘要块不出现', () => {
  const snapshot = createSnapshot()
  const marketState = createMarketState()
  const text = buildStockContext(snapshot, marketState, undefined, undefined)

  assert.match(text, /## 必读核心指标/, '无 history 时必读指标仍应存在')
  assert.ok(!text.includes('## 近 30 日 K 线摘要'), '无 history 时 K 线摘要块应省略')
})

// ==================== buildExpertUserMessage 集成测试 ====================

test('buildExpertUserMessage: history 传入时，user message 包含 K 线摘要', () => {
  const expert = createExpert()
  const snapshot = createSnapshot()
  const marketState = createMarketState()
  const history = createKlineHistory(60)
  const msg = buildExpertUserMessage(expert, snapshot, marketState, undefined, undefined, history)

  assert.match(msg, /## 近 30 日 K 线摘要/, 'user message 应包含 K 线摘要块')
  assert.match(msg, /## 必读核心指标/, 'user message 应包含必读指标块')
  assert.match(msg, /RSI14：68\.5/, 'user message 应包含具体 RSI 数值')
})

test('buildExpertUserMessage: history 缺失时，user message 不崩溃且包含必读指标', () => {
  const expert = createExpert()
  const snapshot = createSnapshot()
  const marketState = createMarketState()
  const msg = buildExpertUserMessage(expert, snapshot, marketState)

  assert.match(msg, /## 必读核心指标/, '即便没 history 必读指标仍在')
  assert.ok(!msg.includes('## 近 30 日 K 线摘要'), '无 history 时不应出现 K 线块')
})
