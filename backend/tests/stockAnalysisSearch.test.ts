import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import childProcess from 'node:child_process'
import { promisify } from 'node:util'

async function createTempStockAnalysisDir() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'clawos-stock-analysis-search-'))
  return {
    tempRoot,
    stockAnalysisDir: path.join(tempRoot, 'AI炒股分析'),
  }
}

/** 创建一个仅响应 A 股全市场脚本的 execFile mock。 */
function createAllAStockExecFileMock(rows: Array<{ code: string; name: string }>) {
  const stdout = JSON.stringify({ success: true, data: rows }) + '\n'

  const mockedExecFile = ((file: string, args?: readonly string[] | null, _options?: object | null, callback?: (...callbackArgs: unknown[]) => void) => {
    const normalizedArgs = Array.isArray(args) ? args : []
    let result: { stdout: string; stderr?: string }

    if (file === 'python3' && normalizedArgs[0] === '-c' && normalizedArgs[1] === 'import site; print(site.getusersitepackages())') {
      result = { stdout: '/tmp/python-site\n', stderr: '' }
    } else if (file === 'python3' && normalizedArgs[0] === '-c') {
      result = { stdout, stderr: '' }
    } else {
      throw new Error(`unexpected execFile call: ${file} ${normalizedArgs.join(' ')}`)
    }

    if (typeof callback === 'function') {
      callback(null, result.stdout, result.stderr ?? '')
    }
    return {} as childProcess.ChildProcess
  }) as typeof childProcess.execFile

  ;(mockedExecFile as typeof childProcess.execFile & { [promisify.custom]?: unknown })[promisify.custom] = async (file: string, args?: readonly string[] | null) => {
    const normalizedArgs = Array.isArray(args) ? args : []
    if (file === 'python3' && normalizedArgs[0] === '-c' && normalizedArgs[1] === 'import site; print(site.getusersitepackages())') {
      return { stdout: '/tmp/python-site\n', stderr: '' }
    }
    if (file === 'python3' && normalizedArgs[0] === '-c') {
      return { stdout, stderr: '' }
    }
    throw new Error(`unexpected execFile call: ${file} ${normalizedArgs.join(' ')}`)
  }

  return mockedExecFile
}

test('searchStockPool 能从 A 股全市场表搜到非中证500的大盘股（京东方 000725）', async () => {
  const originalExecFile = childProcess.execFile
  const { tempRoot, stockAnalysisDir } = await createTempStockAnalysisDir()

  // 模拟 AKShare 返回的全市场数据（含京东方全角Ａ、茅台等）
  ;(childProcess as unknown as { execFile: typeof childProcess.execFile }).execFile = createAllAStockExecFileMock([
    { code: '000725', name: '京东方Ａ' },
    { code: '600519', name: '贵州茅台' },
    { code: '300750', name: '宁德时代' },
    { code: '000001', name: '平安银行' },
  ])

  try {
    const { searchStockPool } = await import('../src/services/stock-analysis/service.js')

    // 按代码搜索
    const byCode = await searchStockPool(stockAnalysisDir, '000725')
    assert.equal(byCode.length, 1)
    assert.equal(byCode[0].code, '000725')
    assert.equal(byCode[0].market, 'sz')
    assert.equal(byCode[0].exchange, '深交所')

    // 按中文名搜索
    const byName = await searchStockPool(stockAnalysisDir, '京东方')
    assert.equal(byName.length, 1)
    assert.equal(byName[0].code, '000725')

    // 按半角A搜索（原始名是全角Ａ，需靠归一化命中）
    const byHalfwidth = await searchStockPool(stockAnalysisDir, '京东方A')
    assert.equal(byHalfwidth.length, 1, '半角A应通过全角归一化命中')
    assert.equal(byHalfwidth[0].code, '000725')

    // 按其他大盘股
    const mao = await searchStockPool(stockAnalysisDir, '茅台')
    assert.equal(mao.length, 1)
    assert.equal(mao[0].code, '600519')
    assert.equal(mao[0].market, 'sh')
    assert.equal(mao[0].exchange, '上交所')

    // 空查询返回空数组
    const empty = await searchStockPool(stockAnalysisDir, '   ')
    assert.deepEqual(empty, [])
  } finally {
    ;(childProcess as unknown as { execFile: typeof childProcess.execFile }).execFile = originalExecFile
    await fs.rm(tempRoot, { recursive: true, force: true })
  }
})

test('searchStockPool 命中结果上限为 20', async () => {
  const { tempRoot, stockAnalysisDir } = await createTempStockAnalysisDir()

  // 预先写入 fresh 缓存（30 只代码含 "600"），绕过 AKShare 拉取
  const cacheDir = path.join(stockAnalysisDir, 'cache')
  await fs.mkdir(cacheDir, { recursive: true })
  const rows = Array.from({ length: 30 }, (_, i) => ({
    code: `6000${String(i).padStart(2, '0')}`,
    name: `测试股票${i}`,
    market: 'sh',
    exchange: '上交所',
    industryName: null,
  }))
  await fs.writeFile(path.join(cacheDir, 'a-stock-all.json'), JSON.stringify(rows), 'utf-8')
  await fs.writeFile(
    path.join(cacheDir, 'a-stock-all.meta.json'),
    JSON.stringify({ refreshedAt: new Date().toISOString() }),
    'utf-8',
  )

  try {
    const { searchStockPool } = await import('../src/services/stock-analysis/service.js')
    const matched = await searchStockPool(stockAnalysisDir, '600')
    assert.equal(matched.length, 20, '上限 20 条')
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true })
  }
})
