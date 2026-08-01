'use strict'

const test = require('brittle')
const {
  generateHashrateHistory,
  generateAndCacheHashrateHistory,
  addNewWorker
} = require('../../mock/initial_states/utils')

test('generateHashrateHistory returns list for unix second range', (t) => {
  const start = Math.floor(new Date('2024-01-01T00:00:00Z').getTime() / 1000)
  const end = Math.floor(new Date('2024-01-01T03:00:00Z').getTime() / 1000)
  const list = generateHashrateHistory(start, end)
  t.ok(Array.isArray(list))
  t.ok(list.length >= 1)
})

test('generateAndCacheHashrateHistory returns same reference on cache hit', (t) => {
  const state = {}
  const start = Math.floor(Date.UTC(2024, 0, 1, 0) / 1000)
  const end = Math.floor(Date.UTC(2024, 0, 1, 2) / 1000)
  const first = generateAndCacheHashrateHistory(start, end, state)
  const second = generateAndCacheHashrateHistory(start, end, state)
  t.is(first, second)
  t.ok(state.hashrate_history_cache)
})

test('addNewWorker throws when worker name already exists', (t) => {
  const workers = []
  addNewWorker(workers, { name: 'pool.dupworker', host: '10.0.0.1' })
  try {
    addNewWorker(workers, { name: 'pool.dupworker', host: '10.0.0.2' })
    t.fail('expected ERR_WORKER_EXISTS')
  } catch (e) {
    t.is(e.message, 'ERR_WORKER_EXISTS')
  }
})
