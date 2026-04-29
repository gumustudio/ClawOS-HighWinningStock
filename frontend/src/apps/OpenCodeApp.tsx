import { useEffect, useState } from 'react'
import { Lock, Play, Power, RefreshCw, RotateCcw } from 'lucide-react'
import IframeApp from './IframeApp'
import { withBasePath } from '../lib/basePath'
import { OpenCodeIcon } from '../components/Icons'

interface OpenCodeStatus {
  unit: string
  status: string
  isRunning: boolean
  health: 'ok' | 'starting' | 'down'
  healthDetail: string
}

export default function OpenCodeApp() {
  const [unlocked, setUnlocked] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState<OpenCodeStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [serviceBusy, setServiceBusy] = useState(false)

  const refreshStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch(withBasePath('/api/system/opencode/status'))
      const payload = await response.json()
      if (payload.success) {
        setStatus(payload.data)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!unlocked) return
    void refreshStatus()
    const timer = window.setInterval(() => void refreshStatus(), 5000)
    return () => window.clearInterval(timer)
  }, [unlocked])

  const unlock = async () => {
    setError('')
    const response = await fetch(withBasePath('/api/system/opencode/unlock'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.success) {
      setError(payload?.error || 'OpenCode 应用锁验证失败')
      return
    }

    setUnlocked(true)
    setPassword('')
  }

  const controlService = async (action: 'start' | 'stop' | 'restart') => {
    setServiceBusy(true)
    try {
      const response = await fetch(withBasePath(`/api/system/opencode/service/${action}`), { method: 'POST' })
      const payload = await response.json()
      if (payload.success) {
        setStatus(payload.data)
      } else {
        setError(payload.error || 'OpenCode 服务操作失败')
      }
    } finally {
      setServiceBusy(false)
      window.setTimeout(() => void refreshStatus(), 1200)
    }
  }

  if (!unlocked) {
    return (
      <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.16),_transparent_38%),linear-gradient(135deg,#020617,#111827)] px-6 text-white">
        <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur-2xl">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
              <OpenCodeIcon className="h-10 w-10" />
            </div>
            <div>
              <div className="text-xl font-bold">OpenCode 应用锁</div>
              <div className="mt-1 text-sm text-slate-300">远程代码操作需要二次验证</div>
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-200">应用锁密码</label>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') void unlock() }}
              type="password"
              autoFocus
              className="w-full rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-teal-300 focus:ring-4 focus:ring-teal-300/10"
              placeholder="输入应用锁密码"
            />
            {error && <div className="text-sm text-rose-300">{error}</div>}
            <button
              type="button"
              onClick={() => void unlock()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-400 px-4 py-3 font-semibold text-slate-950 shadow-lg shadow-teal-950/30 transition hover:bg-teal-300 active:scale-[0.99]"
            >
              <Lock className="h-4 w-4" />
              解锁 OpenCode
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (status?.isRunning && status.health === 'ok') {
    return <IframeApp url={withBasePath('/proxy/opencode/')} title="OpenCode" />
  }

  return (
    <div className="flex h-full items-center justify-center bg-slate-950 px-6 text-white">
      <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-white/[0.06] p-8 shadow-2xl">
        <div className="flex items-center gap-4">
          <OpenCodeIcon className="h-14 w-14" />
          <div>
            <div className="text-2xl font-bold">OpenCode Web</div>
            <div className="mt-1 text-sm text-slate-400">{status?.healthDetail || '正在读取服务状态...'}</div>
          </div>
        </div>
        <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900 p-4 text-sm text-slate-300">
          <div>systemd: <span className="font-mono text-slate-100">{status?.unit || 'opencode-web.service'}</span></div>
          <div className="mt-2">状态: <span className="font-mono text-slate-100">{loading ? 'checking' : status?.status || 'unknown'}</span></div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" disabled={serviceBusy} onClick={() => void controlService('start')} className="flex items-center justify-center gap-2 rounded-2xl bg-teal-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-teal-300 disabled:opacity-60">
            <Play className="h-4 w-4" />启动
          </button>
          <button type="button" disabled={serviceBusy} onClick={() => void controlService('restart')} className="flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-60">
            <RotateCcw className="h-4 w-4" />重启
          </button>
          <button type="button" disabled={serviceBusy} onClick={() => void controlService('stop')} className="flex items-center justify-center gap-2 rounded-2xl bg-rose-500 px-4 py-3 font-semibold text-white transition hover:bg-rose-400 disabled:opacity-60">
            <Power className="h-4 w-4" />关闭
          </button>
          <button type="button" disabled={loading} onClick={() => void refreshStatus()} className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 font-semibold text-white transition hover:bg-white/15 disabled:opacity-60">
            <RefreshCw className="h-4 w-4" />刷新
          </button>
        </div>
        {error && <div className="mt-4 text-sm text-rose-300">{error}</div>}
      </div>
    </div>
  )
}
