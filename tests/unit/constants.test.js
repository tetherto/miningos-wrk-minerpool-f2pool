'use strict'

const test = require('brittle')
const {
  TRANSACTION_TYPES,
  STAT_5M,
  STAT_WORKERS,
  STAT_TRANSACTIONS,
  MINERPOOL_TAG,
  CURRENCY,
  SCHEDULER_TIMES,
  HOUR_MS,
  HOURS_24_MS,
  POOL_TYPE,
  BTC_SATS
} = require('../../workers/lib/constants')

test('constants: should export TRANSACTION_TYPES', (t) => {
  t.ok(TRANSACTION_TYPES)
  t.ok(TRANSACTION_TYPES.REVENUE)
  t.is(TRANSACTION_TYPES.REVENUE, 'revenue')
})

test('constants: should export STAT constants', (t) => {
  t.is(STAT_5M, 'stat-5m')
  t.is(STAT_WORKERS, 'stat-workers')
  t.is(STAT_TRANSACTIONS, 'stat-transactions')
})

test('constants: should export MINERPOOL_TAG', (t) => {
  t.is(MINERPOOL_TAG, 't-minerpool')
})

test('constants: should export CURRENCY', (t) => {
  t.is(CURRENCY, 'bitcoin')
})

test('constants: should export SCHEDULER_TIMES', (t) => {
  t.ok(SCHEDULER_TIMES)
  t.ok(SCHEDULER_TIMES._1M)
  t.ok(SCHEDULER_TIMES._5M)
  t.ok(SCHEDULER_TIMES._1D)

  t.is(SCHEDULER_TIMES._1M.key, '1m')
  t.is(SCHEDULER_TIMES._5M.key, '5m')
  t.is(SCHEDULER_TIMES._1D.key, '1D')

  t.ok(SCHEDULER_TIMES._1M.time)
  t.ok(SCHEDULER_TIMES._5M.time)
  t.ok(SCHEDULER_TIMES._1D.time)
})

test('constants: should export time constants', (t) => {
  t.is(HOUR_MS, 60 * 60 * 1000)
  t.is(HOURS_24_MS, 24 * 60 * 60 * 1000)
})

test('constants: should export POOL_TYPE', (t) => {
  t.is(POOL_TYPE, 'f2pool')
})

test('constants: should export BTC_SATS', (t) => {
  t.is(BTC_SATS, 100000000)
})
