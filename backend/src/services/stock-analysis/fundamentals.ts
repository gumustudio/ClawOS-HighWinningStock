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
 *   1: 股票名称（中文，须含 CJK 字符，用作哨兵）
 *   2: 代码
 *   3: 最新价（数值，哨兵）
 *   39: 市盈率 TTM
 *   44: 总市值（亿元）
 *   46: 市净率
 *   74: ROE(%)
 *
 * v1.35.0 [A1-P0-1/2] 加入哨兵校验：
 *   - parts[1] 必须含中文字符（防止字段错位后把代码/数字当名称）
 *   - parts[3] 必须是正数（防止错位后把名称当价格）
 *   - parts[39]（PE）合理范围 -200 ~ 2000（亏损股允许负 PE，但极端值视为错位）
 *   - parts[46]（PB）合理范围 0 ~ 100
 *   - 任一哨兵失败返回 null 并打印 warn，让外层走 fallback 源
 */
const CJK_REGEX = /[\u3400-\u4dbf\u4e00-\u9fff]/

export function parseTencentQtFundamentals(rawLine: string): StockFundamentals | null {
  const parts = rawLine.split('~')
  if (parts.length < 50) return null
  const code = parts[2]
  if (!/^\d{6}$/.test(code)) return null

  // v1.35.0 [A1-P0-1/2] 哨兵 1：股票名称必须含中文字符（防止 GBK 解码错误导致字段错位）
  const name = parts[1] ?? ''
  if (!CJK_REGEX.test(name)) {
    logger.warn(`[fundamentals] parseTencentQt 哨兵失败 code=${code}: 名称字段无中文字符（疑似字段错位或编码损坏）`, { module: MODULE })
    return null
  }

  // v1.35.0 [A1-P0-1/2] 哨兵 2：最新价必须为正数
  const latestPrice = parseNum(parts[3])
  if (latestPrice === null || latestPrice <= 0) {
    logger.warn(`[fundamentals] parseTencentQt 哨兵失败 code=${code}: 最新价字段非法 (${parts[3]})`, { module: MODULE })
    return null
  }

  // v1.35.0 [A1-P0-1/2] 哨兵 3：PE/PB 合理性校验（字段漂移检测）
  const rawPe = parseNum(parts[39])
  const rawPb = parseNum(parts[46])
  if (rawPe !== null && (rawPe < -200 || rawPe > 2000)) {
    logger.warn(`[fundamentals] parseTencentQt 哨兵失败 code=${code}: PE 超出合理范围 (${rawPe})，疑似字段漂移`, { module: MODULE })
    return null
  }
  if (rawPb !== null && (rawPb < 0 || rawPb > 100)) {
    logger.warn(`[fundamentals] parseTencentQt 哨兵失败 code=${code}: PB 超出合理范围 (${rawPb})，疑似字段漂移`, { module: MODULE })
    return null
  }

  return {
    code,
    // v1.35.0 [A1-P1-4] PE=0 视为不适用（亏损股），转 null 避免 LLM 误读
    peRatio: rawPe !== null && rawPe > 0 ? rawPe : null,
    totalMarketCapYi: parseNum(parts[44]),
    pbRatio: rawPb !== null && rawPb > 0 ? rawPb : null,
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
    // v1.35.0 [A1-P0-1] Tencent qt 返回 GBK 编码，必须用 TextDecoder('gbk') 正确解码。
    // 旧版本用 'binary' (latin1) 解码导致中文含特殊字节时与 ~ 冲突，产生字段错位。
    const buffer = await resp.arrayBuffer()
    const text = new TextDecoder('gbk').decode(buffer)
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
