import assert from 'node:assert/strict'
import test from 'node:test'

import {
  shouldEscalateManualActionFailure,
  shouldNotifyIntradayRisk,
  shouldNotifyPositionRisk,
  shouldShowInAIRiskHistory,
} from './notificationPolicy'

test('shouldShowInAIRiskHistory only keeps high priority passive risk categories', () => {
  assert.equal(shouldShowInAIRiskHistory({ category: 'risk', riskPriority: 'critical' }), true)
  assert.equal(shouldShowInAIRiskHistory({ category: 'data', riskPriority: 'high' }), true)
  assert.equal(shouldShowInAIRiskHistory({ category: 'intraday', riskPriority: 'high' }), true)
  assert.equal(shouldShowInAIRiskHistory({ category: 'execution', riskPriority: 'high' }), false)
  assert.equal(shouldShowInAIRiskHistory({ category: 'risk', riskPriority: 'medium' }), false)
})

test('shouldNotifyPositionRisk only keeps stop loss and avoids intraday duplicate channel', () => {
  assert.equal(shouldNotifyPositionRisk('stop_loss', false), true)
  assert.equal(shouldNotifyPositionRisk('take_profit', false), false)
  assert.equal(shouldNotifyPositionRisk('reduce', false), false)
  assert.equal(shouldNotifyPositionRisk('stop_loss', true), false)
})

test('shouldNotifyIntradayRisk only keeps critical intraday alert types', () => {
  assert.equal(shouldNotifyIntradayRisk('stop_loss'), true)
  assert.equal(shouldNotifyIntradayRisk('daily_loss_limit'), true)
  assert.equal(shouldNotifyIntradayRisk('take_profit_1'), false)
  assert.equal(shouldNotifyIntradayRisk('sector_anomaly'), false)
})

test('shouldEscalateManualActionFailure only escalates paused or abnormal data state', () => {
  assert.equal(shouldEscalateManualActionFailure({ dataState: 'ready', riskPaused: false }), false)
  assert.equal(shouldEscalateManualActionFailure({ dataState: 'stale', riskPaused: false }), true)
  assert.equal(shouldEscalateManualActionFailure({ dataState: 'ready', riskPaused: true }), true)
})
