/**
 * v1.33.0 阶段 E 测试：
 *   P1-2 基本面（PE / PB / 总市值 / ROE）
 *   - toTencentSymbol：6/4/8/0/3 开头前缀判断
 *   - parseTencentQtFundamentals：正确解析字段
 *   - buildFundamentalsBlock：null 返回 []、字段缺失跳过对应行
 *   - readFundamentalsCache：过夜失效
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

import {
  readFundamentalsCache,
  _testing as fundTesting,
} from '../src/services/stock-analysis/fundamentals'
import { _testing as llmTesting } from '../src/services/stock-analysis/llm-inference'
import type { StockFundamentals } from '../src/services/stock-analysis/types'

const { toTencentSymbol, parseTencentQtFundamentals, writeFundamentalsCache } = fundTesting
const { buildFundamentalsBlock } = llmTesting

async function makeTmpDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'fundamentals-test-'))
}

function today(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

test('toTencentSymbol：6 开头 → sh 前缀', () => {
  assert.equal(toTencentSymbol('600519'), 'sh600519')
})

test('toTencentSymbol：0/3 开头 → sz 前缀', () => {
  assert.equal(toTencentSymbol('000001'), 'sz000001')
  assert.equal(toTencentSymbol('300750'), 'sz300750')
})

test('toTencentSymbol：4/8 开头 → bj 前缀', () => {
  assert.equal(toTencentSymbol('430139'), 'bj430139')
  assert.equal(toTencentSymbol('830799'), 'bj830799')
})

test('toTencentSymbol：已带前缀保持不变', () => {
  assert.equal(toTencentSymbol('sh600519'), 'sh600519')
})

test('toTencentSymbol：非法代码返回 null', () => {
  assert.equal(toTencentSymbol('abc'), null)
  assert.equal(toTencentSymbol('12345'), null)
})

test('parseTencentQtFundamentals：parts < 50 返回 null', () => {
  const line = 'v_sh600519="1~贵州茅台~600519~1600.0"'
  assert.equal(parseTencentQtFundamentals(line), null)
})

test('parseTencentQtFundamentals：正确解析 PE/PB/总市值/ROE', () => {
  // 构造一行有 75+ 字段的模拟数据
  // v1.35.0: 必须满足哨兵校验——parts[1] 中文名 + parts[3] 正数价格
  const parts = new Array(80).fill('')
  parts[0] = 'v_sh600519="1'
  parts[1] = '贵州茅台'
  parts[2] = '600519'
  parts[3] = '1600.00' // v1.35.0 哨兵：最新价
  parts[39] = '23.45' // PE
  parts[44] = '20000.5' // 总市值（亿）
  parts[46] = '8.12' // PB
  parts[74] = '31.5' // ROE
  const line = parts.join('~')
  const result = parseTencentQtFundamentals(line)
  assert.ok(result)
  assert.equal(result.code, '600519')
  assert.equal(result.peRatio, 23.45)
  assert.equal(result.pbRatio, 8.12)
  assert.equal(result.totalMarketCapYi, 20000.5)
  assert.equal(result.roePercent, 31.5)
  assert.equal(result.source, 'tencent')
  assert.equal(result.fetchedDate, today())
})

test('parseTencentQtFundamentals：数字字段为空时解析为 null', () => {
  // v1.35.0: 必须满足哨兵校验——parts[1] 中文名 + parts[3] 正数价格
  const parts = new Array(80).fill('')
  parts[1] = '贵州茅台'
  parts[2] = '600519'
  parts[3] = '1600.00'
  parts[39] = '' // PE 缺失
  parts[44] = '20000.5'
  parts[46] = '8.12'
  parts[74] = ''
  const line = parts.join('~')
  const result = parseTencentQtFundamentals(line)
  assert.ok(result)
  assert.equal(result.peRatio, null)
  assert.equal(result.roePercent, null)
  assert.equal(result.pbRatio, 8.12)
})

test('buildFundamentalsBlock：null 返回空数组', () => {
  const lines = buildFundamentalsBlock(null)
  assert.deepEqual(lines, [])
})

test('buildFundamentalsBlock：包含所有可用字段', () => {
  const fund: StockFundamentals = {
    code: '600519',
    peRatio: 23.45,
    pbRatio: 8.12,
    totalMarketCapYi: 20000.5,
    roePercent: 31.5,
    fetchedDate: today(),
    fetchedAt: new Date().toISOString(),
    source: 'tencent',
  }
  const lines = buildFundamentalsBlock(fund)
  const text = lines.join('\n')
  assert.match(text, /市盈率.*23\.45/)
  assert.match(text, /市净率.*8\.12/)
  assert.match(text, /总市值.*20000/)
  assert.match(text, /ROE.*31\.50/)
})

test('buildFundamentalsBlock：缺失字段不输出对应行', () => {
  const fund: StockFundamentals = {
    code: '600519',
    peRatio: null,
    pbRatio: 8.12,
    totalMarketCapYi: null,
    roePercent: null,
    fetchedDate: today(),
    fetchedAt: new Date().toISOString(),
    source: 'tencent',
  }
  const lines = buildFundamentalsBlock(fund)
  const text = lines.join('\n')
  assert.ok(!/市盈率/.test(text), 'PE 缺失不应出现')
  assert.ok(!/ROE/.test(text), 'ROE 缺失不应出现')
  assert.match(text, /市净率.*8\.12/)
})

test('readFundamentalsCache：当日写入的缓存可读取', async () => {
  const dir = await makeTmpDir()
  const data: StockFundamentals = {
    code: '600519',
    peRatio: 23.45,
    pbRatio: 8.12,
    totalMarketCapYi: 20000,
    roePercent: 31,
    fetchedDate: today(),
    fetchedAt: new Date().toISOString(),
    source: 'tencent',
  }
  await writeFundamentalsCache(dir, data)
  const loaded = await readFundamentalsCache(dir, '600519')
  assert.ok(loaded)
  assert.equal(loaded.peRatio, 23.45)
})

test('readFundamentalsCache：过夜缓存（fetchedDate != today）返回 null', async () => {
  const dir = await makeTmpDir()
  const data: StockFundamentals = {
    code: '600519',
    peRatio: 23.45,
    pbRatio: 8.12,
    totalMarketCapYi: 20000,
    roePercent: 31,
    fetchedDate: '1999-01-01', // 远古日期
    fetchedAt: '1999-01-01T00:00:00Z',
    source: 'tencent',
  }
  await writeFundamentalsCache(dir, data)
  const loaded = await readFundamentalsCache(dir, '600519')
  assert.equal(loaded, null)
})

test('readFundamentalsCache：不存在的文件返回 null', async () => {
  const dir = await makeTmpDir()
  const loaded = await readFundamentalsCache(dir, '999999')
  assert.equal(loaded, null)
})
