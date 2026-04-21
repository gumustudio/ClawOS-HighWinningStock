import test from 'node:test'
import assert from 'node:assert/strict'

import { GlobalSettingsTab } from './GlobalSettingsTab'

test('GlobalSettingsTab exports component for AIQuant global settings tab', () => {
  assert.equal(typeof GlobalSettingsTab, 'function')
})
