import type { IntradayAlert, PositionAction, StockAnalysisDataState } from './types'

const AI_RISK_HISTORY_CATEGORIES = new Set(['risk', 'data', 'intraday'])
const AI_RISK_HISTORY_PRIORITIES = new Set(['critical', 'high'])
const CRITICAL_INTRADAY_ALERT_TYPES = new Set<IntradayAlert['alertType']>(['stop_loss', 'daily_loss_limit'])
const CRITICAL_POSITION_ACTIONS = new Set<PositionAction>(['stop_loss'])

export function shouldShowInAIRiskHistory(metadata: Record<string, unknown>): boolean {
  const category = typeof metadata.category === 'string' ? metadata.category : ''
  const riskPriority = typeof metadata.riskPriority === 'string' ? metadata.riskPriority : ''
  return AI_RISK_HISTORY_CATEGORIES.has(category) && AI_RISK_HISTORY_PRIORITIES.has(riskPriority)
}

export function shouldNotifyPositionRisk(action: PositionAction, intradayMonitorRunning: boolean): boolean {
  if (intradayMonitorRunning) {
    return false
  }
  return CRITICAL_POSITION_ACTIONS.has(action)
}

export function shouldNotifyIntradayRisk(alertType: IntradayAlert['alertType']): boolean {
  return CRITICAL_INTRADAY_ALERT_TYPES.has(alertType)
}

export function shouldEscalateManualActionFailure(input: {
  dataState: StockAnalysisDataState
  riskPaused: boolean
}): boolean {
  return input.riskPaused || input.dataState !== 'ready'
}
