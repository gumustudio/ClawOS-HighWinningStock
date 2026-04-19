/**
 * [v1.33.0 阶段 E] 股票基本面采集 + 本地缓存
 *
 * 职责：
 *  - 从 Tencent qt 接口批量抓取 PE / PB / 总市值 / ROE
 *  - 本地缓存到 {stockAnalysisDir}/cache/fundamentals/{code}.json
 *  - 以 fetchedDate 判断过夜失效（不同于当日即重新抓取）
 *  - LLM prompt 中按"公司基本面"层注入
 *
 * 数据源稳定性：Tencent qt (https://qt.gtimg.cn/q=sh600519,sz000001,...) 项目已验证
 */

import fs from 'fs/promises'
import path from 'path'

import { logger } from '../../utils/logger'
import { formatDateStr } from './trading-calendar'
import type { StockFundamentals } from './types'

const MODULE = 'Fundamentals'
const CACHE_DIRNAME = 'cache/fundamentals'
const FETCH_TIMEOUT_MS = 8000
const BATCH_SIZE = 30 // Tencent qt 单次可查 30-50 只
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/** 将通用股票代码转为 Tencent qt 参数形式（sh600519 / sz000001 / bj430139） */
function toTencentSymbol(code: string): string | null {
  const raw = code.trim().toLowerCase()
  if (/^(sh|sz|bj)\d{6}$/.test(raw)) return raw
  if (!/^\d{6}$/.test(raw)) return null
  // 6 位数字：按首位推断
  const first = raw[0]
  if (first === '6') return `sh${raw}`
  if (first === '4' || first === '8') return `bj${raw}`
  return `sz${raw}`
}

/** 剥离 sh/sz/bj 前缀，返回纯 6 位代码 */
function normalizeCode(code: string): string {
  const raw = code.trim().toLowerCase()
  if (/^(sh|sz|bj)\d{6}$/.test(raw)) return raw.slice(2)
  return raw
}

function cacheFilePath(stockAnalysisDir: string, code: string): string {
  return path.join(stockAnalysisDir, CACHE_DIRNAME, `${normalizeCode(code)}.json`)
}

/** 读取单只股票缓存；若缓存日 != today 则返回 null（过夜失效） */
export async function readFundamentalsCache(
  stockAnalysisDir: string,
  code: string,
): Promise<StockFundamentals | null> {
  try {
    const content = await fs.readFile(cacheFilePath(stockAnalysisDir, code), 'utf-8')
    const data = JSON.parse(content) as StockFundamentals
    if (data.fetchedDate !== formatDateStr(new Date())) return null // 过夜失效
    return data
  } catch {
    return null
  }
}

/** 写入缓存 */
async function writeFundamentalsCache(
  stockAnalysisDir: string,
  data: StockFundamentals,
): Promise<void> {
  const dir = path.join(stockAnalysisDir, CACHE_DIRNAME)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(cacheFilePath(stockAnalysisDir, data.code), JSON.stringify(data, null, 2), 'utf-8')
}

/** 将一个数字字符串转为 number，失败返回 null */
function parseNum(s: string | undefined): number | null {
  if (!s || s.trim() === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/**
 * 解析 Tencent qt 单条记录（按 ~ 分割）
 *
 * 字段索引参考（社区验证 + 项目实测）：
 *   0: v_{symbol}="1 (前缀，跳过)
 *   2: 代码
 *   39: 市盈率 TTM
 *   44: 总市值（亿元）
 *   46: 市净率
 *   74: ROE(%)
 */
export function parseTencentQtFundamentals(rawLine: string): StockFundamentals | null {
  const parts = rawLine.split('~')
  if (parts.length < 50) return null
  const code = parts[2]
  if (!/^\d{6}$/.test(code)) return null
  return {
    code,
    peRatio: parseNum(parts[39]),
    totalMarketCapYi: parseNum(parts[44]),
    pbRatio: parseNum(parts[46]),
    roePercent: parts.length > 74 ? parseNum(parts[74]) : null,
    fetchedDate: formatDateStr(new Date()),
    fetchedAt: new Date().toISOString(),
    source: 'tencent',
  }
}

/** 批量从 Tencent qt 抓 */
async function fetchBatchFromTencent(codes: string[]): Promise<Map<string, StockFundamentals>> {
  const result = new Map<string, StockFundamentals>()
  const symbols = codes.map(toTencentSymbol).filter((s): s is string => s !== null)
  if (symbols.length === 0) return result

  const url = `https://qt.gtimg.cn/q=${symbols.join(',')}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Referer: 'https://stockapp.finance.qq.com/' },
      signal: controller.signal,
    })
    if (!resp.ok) {
      logger.warn(`[fundamentals] Tencent qt HTTP ${resp.status}`, { module: MODULE })
      return result
    }
    // Tencent qt 返回 GBK 编码的中文名，但我们只用数字字段，忽略文本部分即可
    const buffer = await resp.arrayBuffer()
    const text = Buffer.from(buffer).toString('binary')
    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
    for (const line of lines) {
      const parsed = parseTencentQtFundamentals(line)
      if (parsed) result.set(parsed.code, parsed)
    }
  } catch (error) {
    logger.warn(`[fundamentals] Tencent qt 抓取失败: ${(error as Error).message}`, { module: MODULE })
  } finally {
    clearTimeout(timer)
  }
  return result
}

/**
 * 批量获取基本面（带缓存）：
 *   1. 逐个检查缓存，命中的用缓存
 *   2. 未命中的按 BATCH_SIZE 分批从 Tencent 抓
 *   3. 新抓到的写入缓存
 *   4. 最终返回 code → fundamentals（未抓到的不在 Map 中）
 */
export async function fetchFundamentalsForCodes(
  stockAnalysisDir: string,
  codes: string[],
): Promise<Map<string, StockFundamentals>> {
  const result = new Map<string, StockFundamentals>()
  const toFetch: string[] = []

  for (const code of codes) {
    const normalized = normalizeCode(code)
    const cached = await readFundamentalsCache(stockAnalysisDir, normalized)
    if (cached) {
      result.set(normalized, cached)
    } else {
      toFetch.push(normalized)
    }
  }

  if (toFetch.length === 0) return result

  // 分批抓取
  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    const batch = toFetch.slice(i, i + BATCH_SIZE)
    const fetched = await fetchBatchFromTencent(batch)
    for (const [code, data] of fetched) {
      result.set(code, data)
      try {
        await writeFundamentalsCache(stockAnalysisDir, data)
      } catch (error) {
        logger.warn(`[fundamentals] 写缓存失败 ${code}: ${(error as Error).message}`, { module: MODULE })
      }
    }
  }

  logger.info(
    `[fundamentals] 批量获取完成: 请求=${codes.length} 缓存命中=${codes.length - toFetch.length} 新抓=${toFetch.length - (toFetch.length - (result.size - (codes.length - toFetch.length)))}`,
    { module: MODULE },
  )
  return result
}

export const _testing = {
  toTencentSymbol,
  normalizeCode,
  parseTencentQtFundamentals,
  fetchBatchFromTencent,
  writeFundamentalsCache,
}
