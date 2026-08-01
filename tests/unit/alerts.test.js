'use strict'

const test = require('brittle')
const { ALERT_SPECS, DEVICE, buildAlerts } = require('../../workers/lib/alerts')

test('ALERT_SPECS: defines the F2pool_Offline alert', (t) => {
  const spec = ALERT_SPECS.find(s => s.name === 'F2pool_Offline')
  t.ok(spec, 'spec exists')
  t.is(spec.severity, 'critical')
  t.is(spec.description, 'F2Pool is offline')
})

test('buildAlerts: raises F2pool_Offline when offline', (t) => {
  const alerts = buildAlerts({ f2pool: 'offline' }, {}, 1000)
  t.is(alerts.length, 1)
  const a = alerts[0]
  t.is(a.name, 'F2pool_Offline')
  t.is(a.description, 'F2Pool is offline')
  t.is(a.severity, 'critical')
  t.is(a.createdAt, 1000)
  t.ok(a.uuid)
  t.is(a.type, 'minerpool')
  t.is(a.deviceId, DEVICE.deviceId)
  t.is(a.id, DEVICE.id)
  t.is(a.code, DEVICE.code)
})

test('buildAlerts: no alerts when online', (t) => {
  t.alike(buildAlerts({ f2pool: 'online' }, {}, 1000), [])
})

test('buildAlerts: no alerts when status is null', (t) => {
  t.alike(buildAlerts({ f2pool: null }, {}, 1000), [])
})

test('buildAlerts: keeps createdAt/uuid stable via prev', (t) => {
  const first = buildAlerts({ f2pool: 'offline' }, {}, 1000)[0]
  const prev = { [first.name]: first }
  const second = buildAlerts({ f2pool: 'offline' }, prev, 5000)[0]
  t.is(second.createdAt, 1000, 'createdAt preserved')
  t.is(second.uuid, first.uuid, 'uuid preserved')
})
