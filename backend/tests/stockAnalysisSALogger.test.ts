import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

test('sa-logger cleanup removes undated debug log and trims total size', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'clawos-sa-logger-'))
  const stockAnalysisDir = path.join(tempRoot, 'AI炒股分析')
  const logsDir = path.join(stockAnalysisDir, 'logs')

  try {
    await fs.mkdir(logsDir, { recursive: true })
    await fs.writeFile(path.join(logsDir, 'stock-analysis-debug.log'), 'legacy-debug', 'utf8')
    await fs.writeFile(path.join(logsDir, 'llm-calls-2026-03-01.jsonl'), 'old-file', 'utf8')

    const { initSALogger, _testing } = await import(`../src/services/stock-analysis/sa-logger?ts=${Date.now()}-cleanup`)

    await initSALogger(stockAnalysisDir)
    await _testing.cleanupOldLogs()

    await assert.rejects(fs.access(path.join(logsDir, 'stock-analysis-debug.log')))
    await assert.rejects(fs.access(path.join(logsDir, 'llm-calls-2026-03-01.jsonl')))
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true })
  }
})
