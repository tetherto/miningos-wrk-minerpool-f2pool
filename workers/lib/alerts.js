'use strict'

const { randomUUID } = require('crypto')
const { POOL_TYPE } = require('./constants')

// Synthetic device identity matching the fields app-node adds to thing alerts.
const DEVICE = {
  id: `minerpool-${POOL_TYPE}`,
  deviceId: `minerpool-${POOL_TYPE}`,
  type: 'minerpool',
  code: POOL_TYPE,
  container: null,
  position: null
}

const ALERT_SPECS = [
  {
    name: 'F2pool_Offline',
    description: 'F2Pool is offline',
    severity: 'critical',
    active: (status) => status.f2pool === 'offline'
  }
]

// `prev` (active alerts keyed by name) keeps createdAt/uuid stable across evaluations.
function buildAlerts (status, prev = {}, now = Date.now()) {
  const alerts = []
  for (const spec of ALERT_SPECS) {
    if (!spec.active(status)) continue
    const existing = prev[spec.name]
    alerts.push({
      name: spec.name,
      code: DEVICE.code,
      description: spec.description,
      severity: spec.severity,
      createdAt: existing?.createdAt ?? now,
      uuid: existing?.uuid ?? randomUUID(),
      message: undefined,
      id: DEVICE.id,
      deviceId: DEVICE.deviceId,
      type: DEVICE.type,
      container: DEVICE.container,
      position: DEVICE.position
    })
  }
  return alerts
}

module.exports = { ALERT_SPECS, DEVICE, buildAlerts }
