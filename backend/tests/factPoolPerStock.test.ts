/**
 * v1.33.0 阶段 C 测试：
 *   P0-3 FactPool 拆分为 global + perStock
 *   - 公告：按股票代码过滤，本股优先，补全局 major
 *   - 行业新闻：按 snapshot.sector 过滤，本行业优先
 *   - buildFactPoolSummaryForStock：返回的 summary 结构不变，但 highlights 内容已针对个股
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildFactPoolSummary,
  buildFactPoolSummaryForStock,
  _testing as memTesting,
} from '../src/services/stock-analysis/memory'
import type { FactPool } from '../src/services/stock-analysis/types'

const { buildAnnouncementHighlightsForStock, buildIndustryHighlightsForStock } = memTesting

function createFactPool(overrides?: Partial<FactPool>): FactPool {
  return {
    updatedAt: '2026-04-18T16:00:00+08:00',
    tradeDate: '2026-04-18',
    macroData: null,
    policyEvents: [],
    companyAnnouncements: [],
    industryNews: [],
    socialSentiment: [],
    globalMarkets: null,
    priceVolumeExtras: null,
    dataQuality: null,
    agentLogs: [],
    ...overrides,
  }
}

// ==================== buildAnnouncementHighlightsForStock ====================

test('buildAnnouncementHighlightsForStock: 该股票自身公告优先返回，并标注【本股】', () => {
  const factPool = createFactPool({
    companyAnnouncements: [
      { code: '000001', name: '平安银行', title: '2025Q4业绩预增', publishedAt: '', category: 'earnings', importance: 'major', rawText: '' },
      { code: '600519', name: '贵州茅台', title: '股东大会决议', publishedAt: '', category: 'other', importance: 'normal', rawText: '' },
      { code: '600519', name: '贵州茅台', title: '2026Q1经营数据', publishedAt: '', category: 'earnings', importance: 'major', rawText: '' },
    ],
  })
  const result = buildAnnouncementHighlightsForStock(factPool, '600519')
  // 该股票 2 条公告都应在前
  assert.ok(result[0].startsWith('【本股】'), `首条应为本股，实际=${result[0]}`)
  assert.ok(result[1].startsWith('【本股】'), `次条应为本股，实际=${result[1]}`)
  assert.ok(result.some((s) => s.includes('2026Q1经营数据')))
  assert.ok(result.some((s) => s.includes('股东大会决议')))
})

test('buildAnnouncementHighlightsForStock: 本股不足则用其他 major 公告补齐（标注【其他】）', () => {
  const factPool = createFactPool({
    companyAnnouncements: [
      { code: '600519', name: '贵州茅台', title: '2026Q1业绩', publishedAt: '', category: 'earnings', importance: 'major', rawText: '' },
      { code: '000001', name: '平安银行', title: '增持计划', publishedAt: '', category: 'equity_change', importance: 'major', rawText: '' },
      { code: '600036', name: '招商银行', title: '分红方案', publishedAt: '', category: 'other', importance: 'major', rawText: '' },
      { code: '300750', name: '宁德时代', title: '日常公告', publishedAt: '', category: 'other', importance: 'normal', rawText: '' },
    ],
  })
  const result = buildAnnouncementHighlightsForStock(factPool, '600519')
  assert.equal(result.length, 3, `应输出 3 条，实际=${result.length}`)
  assert.ok(result[0].startsWith('【本股】'))
  // 后面是其他的 major（不含 normal）
  assert.ok(result.slice(1).every((s) => s.startsWith('【其他】')))
  assert.ok(!result.some((s) => s.includes('日常公告')), '不应包含 normal 级别的其他股公告')
})

test('buildAnnouncementHighlightsForStock: 处理带市场前缀的 code（sh600519 / 600519 应视作同一股）', () => {
  const factPool = createFactPool({
    companyAnnouncements: [
      { code: 'sh600519', name: '贵州茅台', title: '重要事项', publishedAt: '', category: 'other', importance: 'major', rawText: '' },
    ],
  })
  const result = buildAnnouncementHighlightsForStock(factPool, '600519')
  assert.equal(result.length, 1)
  assert.ok(result[0].startsWith('【本股】'))
})

test('buildAnnouncementHighlightsForStock: 空公告列表返回空数组', () => {
  const factPool = createFactPool()
  assert.deepEqual(buildAnnouncementHighlightsForStock(factPool, '600519'), [])
})

// ==================== buildIndustryHighlightsForStock ====================

test('buildIndustryHighlightsForStock: 本行业新闻优先，标注【本行业】', () => {
  const factPool = createFactPool({
    industryNews: [
      { id: '1', title: '新能源车销量创新高', source: '', publishedAt: '', sectors: ['新能源汽车', '锂电池'], rawSummary: '' },
      { id: '2', title: '白酒行业 2025 年复盘', source: '', publishedAt: '', sectors: ['酿酒行业'], rawSummary: '' },
      { id: '3', title: '半导体出口管制收紧', source: '', publishedAt: '', sectors: ['半导体'], rawSummary: '' },
    ],
  })
  const result = buildIndustryHighlightsForStock(factPool, '酿酒行业')
  assert.ok(result[0].startsWith('【本行业】'))
  assert.ok(result[0].includes('白酒行业'))
  assert.ok(result.slice(1).every((s) => s.startsWith('【其他行业】')))
})

test('buildIndustryHighlightsForStock: sector 为 null/undefined 时退化为取前 5 条', () => {
  const factPool = createFactPool({
    industryNews: [
      { id: '1', title: 'A', source: '', publishedAt: '', sectors: ['行业1'], rawSummary: '' },
      { id: '2', title: 'B', source: '', publishedAt: '', sectors: ['行业2'], rawSummary: '' },
    ],
  })
  const result = buildIndustryHighlightsForStock(factPool, null)
  assert.equal(result.length, 2)
  assert.equal(result[0], 'A')
})

test('buildIndustryHighlightsForStock: sector 模糊匹配（包含关系）也算命中', () => {
  const factPool = createFactPool({
    industryNews: [
      { id: '1', title: '新能源车补贴延续', source: '', publishedAt: '', sectors: ['汽车整车'], rawSummary: '' },
    ],
  })
  // snapshot.sector="汽车" 与 news.sectors=["汽车整车"] 相互包含
  const result = buildIndustryHighlightsForStock(factPool, '汽车')
  assert.ok(result[0].startsWith('【本行业】'))
})

// ==================== buildFactPoolSummaryForStock 整体 ====================

test('buildFactPoolSummaryForStock: 与 buildFactPoolSummary 结构一致，但 highlights 针对个股', () => {
  const factPool = createFactPool({
    companyAnnouncements: [
      { code: '600519', name: '贵州茅台', title: '公司专属公告', publishedAt: '', category: 'other', importance: 'normal', rawText: '' },
      { code: '000001', name: '平安银行', title: '其他股 major', publishedAt: '', category: 'other', importance: 'major', rawText: '' },
    ],
    industryNews: [
      { id: '1', title: '白酒消费税调整', source: '', publishedAt: '', sectors: ['酿酒行业'], rawSummary: '' },
      { id: '2', title: '芯片禁令', source: '', publishedAt: '', sectors: ['半导体'], rawSummary: '' },
    ],
  })

  const globalSummary = buildFactPoolSummary(factPool)
  const stockSummary = buildFactPoolSummaryForStock(factPool, '600519', '酿酒行业')

  // 结构字段完全一致
  assert.deepEqual(Object.keys(stockSummary).sort(), Object.keys(globalSummary).sort())

  // stock 版本的公告首条必须是本股
  assert.ok(stockSummary.announcementHighlights[0].startsWith('【本股】'))
  assert.ok(stockSummary.announcementHighlights[0].includes('公司专属公告'))

  // stock 版本的行业首条必须是本行业
  assert.ok(stockSummary.industryHighlights[0].startsWith('【本行业】'))
  assert.ok(stockSummary.industryHighlights[0].includes('白酒消费税'))
})
