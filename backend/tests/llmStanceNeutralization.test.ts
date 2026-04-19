/**
 * v1.33.0 阶段 B 测试（P1-3：移除 stance 预设结论）
 *   - buildFallbackVote 新版本：stance 不再决定 verdict，纯数据驱动
 *   - 同一数据下，不同 stance 的专家 verdict 应一致（只 confidence 有微小偏置）
 *   - STANCE_GUIDE 文案已改为"视角偏好"，不再使用"倾向偏乐观/谨慎"措辞
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { _testing as llmTesting } from '../src/services/stock-analysis/llm-inference'
import type {
  StockAnalysisStockSnapshot,
  StockAnalysisExpertDefinition,
} from '../src/services/stock-analysis/types'

const { buildFallbackVote, buildExpertSystemMessage } = llmTesting

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
    declineDays20d: 0,
    return5d: 2.1,
    return20d: 8.0,
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
    rsi14: 62,
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
    scoreReason: [],
    ...overrides,
  }
}

function createExpert(stance: 'bullish' | 'bearish' | 'neutral', overrides?: Partial<StockAnalysisExpertDefinition>): StockAnalysisExpertDefinition {
  return {
    id: `exp-${stance}`,
    name: `${stance}专家`,
    layer: 'company_fundamentals',
    stance,
    enabled: true,
    weight: 1,
    ...overrides,
  } as StockAnalysisExpertDefinition
}

// ==================== buildFallbackVote：stance 不决定 verdict ====================

test('buildFallbackVote: 强多头信号下，三种 stance 专家 verdict 一致为 bullish', () => {
  const snapshot = createSnapshot({
    return20d: 10,
    movingAverage20Slope: 0.15,
    rsi14: 55,
    macdHistogram: 3.0,
    industryStrength: 0.8,
  })
  const bullVote = buildFallbackVote(createExpert('bullish'), snapshot, 0)
  const bearVote = buildFallbackVote(createExpert('bearish'), snapshot, 0)
  const neutVote = buildFallbackVote(createExpert('neutral'), snapshot, 0)

  assert.equal(bullVote.verdict, 'bullish', 'bullish 专家应给 bullish')
  assert.equal(bearVote.verdict, 'bullish', '强多头信号下 bearish 专家也应诚实给 bullish（stance 不决定方向）')
  assert.equal(neutVote.verdict, 'bullish', 'neutral 专家应给 bullish')
})

test('buildFallbackVote: 强空头信号下，三种 stance 专家 verdict 一致为 bearish', () => {
  const snapshot = createSnapshot({
    return20d: -12,
    declineDays20d: 7,
    movingAverage20Slope: -0.15,
    latestPrice: 1700,
    movingAverage20: 1800,
    rsi14: 25,
    macdHistogram: -3.0,
    industryStrength: 0.2,
  })
  const bullVote = buildFallbackVote(createExpert('bullish'), snapshot, 0)
  const bearVote = buildFallbackVote(createExpert('bearish'), snapshot, 0)
  const neutVote = buildFallbackVote(createExpert('neutral'), snapshot, 0)

  // 强空头：RSI 超卖会给 +1 反向分，但其他信号累计仍强烈负向 → bearish
  assert.equal(bullVote.verdict, 'bearish', 'bullish 专家也应诚实给 bearish')
  assert.equal(bearVote.verdict, 'bearish', 'bearish 专家应给 bearish')
  assert.equal(neutVote.verdict, 'bearish', 'neutral 专家应给 bearish')
})

test('buildFallbackVote: 中性信号下，所有专家都给 neutral', () => {
  const snapshot = createSnapshot({
    return20d: 0.5,
    declineDays20d: 1,
    movingAverage20Slope: 0,
    latestPrice: 1800,
    movingAverage20: 1800,
    rsi14: 50,
    macdHistogram: 0.1,
    industryStrength: 0.5,
  })
  for (const stance of ['bullish', 'bearish', 'neutral'] as const) {
    const vote = buildFallbackVote(createExpert(stance), snapshot, 0)
    assert.equal(vote.verdict, 'neutral', `${stance} 专家在中性信号下应给 neutral`)
  }
})

test('buildFallbackVote: stance 仅微调 confidence，不改变 verdict 方向', () => {
  const snapshot = createSnapshot({
    return20d: 10,
    movingAverage20Slope: 0.15,
  })
  const bullVote = buildFallbackVote(createExpert('bullish'), snapshot, 0)
  const bearVote = buildFallbackVote(createExpert('bearish'), snapshot, 0)

  assert.equal(bullVote.verdict, bearVote.verdict, 'verdict 方向应相同')
  // bullish 专家看多时 confidence 略高于 bearish 专家看多
  assert.ok(bullVote.confidence > bearVote.confidence, `bullish stance 看多 confidence=${bullVote.confidence} 应 > bearish stance 看多 confidence=${bearVote.confidence}`)
  // 偏置幅度不大（≤ 10）
  assert.ok(bullVote.confidence - bearVote.confidence <= 10, '偏置幅度应 ≤ 10')
})

test('buildFallbackVote: reason 描述基于数据而非 stance', () => {
  const snapshot = createSnapshot({ return20d: 10, movingAverage20Slope: 0.15 })
  const vote = buildFallbackVote(createExpert('bullish'), snapshot, 0)

  // reason 不应包含"立场偏多"等 stance 词汇
  assert.ok(!vote.reason.includes('立场偏多'), `新版本 reason 不应使用"立场偏多"旧措辞：${vote.reason}`)
  assert.ok(!vote.reason.includes('下行趋势明确，谨慎'), `新版本 reason 不应使用旧措辞：${vote.reason}`)
  // 应包含具体数据信号
  assert.match(vote.reason, /20日涨|MA20上行/, `reason 应基于实际技术信号：${vote.reason}`)
})

// ==================== STANCE_GUIDE 文案测试 ====================

test('buildExpertSystemMessage: 立场引导已改为"视角"表述，不再暗示结论', () => {
  const expertBull = createExpert('bullish', { systemPrompt: undefined })
  const expertBear = createExpert('bearish', { systemPrompt: undefined })
  const msgBull = buildExpertSystemMessage(expertBull)
  const msgBear = buildExpertSystemMessage(expertBear)

  // 不再出现旧的"倾向偏乐观/谨慎"措辞
  assert.ok(!msgBull.includes('倾向偏乐观'), 'bullish 系统消息不应含旧"倾向偏乐观"措辞')
  assert.ok(!msgBear.includes('倾向偏谨慎'), 'bearish 系统消息不应含旧"倾向偏谨慎"措辞')
  // 出现新措辞
  assert.match(msgBull, /机会发现|视角/, 'bullish 应使用"机会发现"或"视角"新措辞')
  assert.match(msgBear, /风险识别|视角/, 'bearish 应使用"风险识别"或"视角"新措辞')
})
