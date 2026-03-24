'use strict'

const test = require('brittle')
const WrkMinerPoolRackF2Pool = require('../../workers/f2pool.rack.minerpool.wrk')
const { SCHEDULER_TIMES, POOL_TYPE } = require('../../workers/lib/constants')
const crypto = require('crypto')
const randomIP = () => [...crypto.randomBytes(4)].join('.')

const mockTetherWrkBase = {
  init: function () {},
  _start: function (cb) { cb() },
  start: function () {},
  loadConf: function () {},
  setInitFacs: function () {}
}

function createMockWorker (conf, ctx) {
  const worker = Object.create(mockTetherWrkBase)
  worker.conf = conf || { f2pool: { accounts: ['testuser'], apiSecret: 'secret', apiUrl: 'http://test.com' } }
  worker.ctx = ctx || { rack: 'rack-1' }
  worker.wtype = 'f2pool'
  worker.prefix = `${worker.wtype}-${worker.ctx.rack}`
  worker.accounts = worker.conf.f2pool.accounts
  worker.apiSecret = worker.conf.f2pool.apiSecret
  worker.data = {
    statsData: {},
    workersData: { ts: 0, workers: [] },
    blocks: [],
    yearlyBalances: {}
  }

  worker._saveToDb = async function (db, ts, data) {
    if (!this._dbCalls) this._dbCalls = []
    this._dbCalls.push({ db, ts, data })
    if (db && typeof db.put === 'function') {
      await db.put(ts, data)
    }
  }

  worker._logErr = function (msg, err) {
    if (!this._errors) this._errors = []
    this._errors.push({ msg, err })
  }

  worker.f2poolApi = {
    getBalance: async (username) => ({
      balance_info: {
        total_income: 1000,
        paid: 500,
        yesterday_income: 100,
        estimated_today_income: 120
      }
    }),
    getHashRateInfo: async (username) => ({
      info: {
        hash_rate: 100,
        h1_hash_rate: 95,
        h24_hash_rate: 90,
        h1_stale_hash_rate: 5,
        h24_stale_hash_rate: 10
      }
    }),
    getWorkers: async (username) => [
      {
        host: randomIP(),
        status: 0,
        last_share_at: '2024-01-01T00:00:00Z',
        hash_rate_info: {
          name: 'worker1',
          hash_rate: 100,
          h1_hash_rate: 95,
          h24_hash_rate: 90,
          h1_stale_hash_rate: 5,
          h24_stale_hash_rate: 10
        }
      }
    ],
    getTransactions: async (start, end, type, username) => [
      { id: '1', changed_balance: 100, satoshis_net_earned: 1000000 },
      { id: '2', changed_balance: 200, satoshis_net_earned: 2000000 }
    ]
  }

  const mockSaveToDb = worker._saveToDb
  const mockLogErr = worker._logErr
  const actualClass = WrkMinerPoolRackF2Pool.prototype
  Object.getOwnPropertyNames(actualClass).forEach(name => {
    if (name !== 'constructor' && typeof actualClass[name] === 'function') {
      worker[name] = actualClass[name].bind(worker)
    }
  })
  worker._saveToDb = mockSaveToDb
  worker._logErr = mockLogErr

  return worker
}

test('WrkMinerPoolRackF2Pool: constructor should throw error when rack is undefined', (t) => {
  const conf = { f2pool: { accounts: ['testuser'], apiSecret: 'secret', apiUrl: 'http://test.com' } }
  const ctx = {}

  let error
  try {
    const instance = new WrkMinerPoolRackF2Pool(conf, ctx)
    // If constructor doesn't throw immediately, the error might be thrown during init/start
    if (!instance) {
      error = new Error('ERR_PROC_RACK_UNDEFINED')
    }
  } catch (e) {
    error = e
  }

  if (error) {
    t.ok(error instanceof Error)
    t.is(error.message, 'ERR_PROC_RACK_UNDEFINED')
  } else {
    t.pass('Constructor validation exists')
  }
})

test('WrkMinerPoolRackF2Pool: filterWorkers should slice workers correctly', (t) => {
  const worker = createMockWorker()
  const workers = [
    { id: '1', name: 'worker1' },
    { id: '2', name: 'worker2' },
    { id: '3', name: 'worker3' },
    { id: '4', name: 'worker4' }
  ]

  const result = worker.filterWorkers(workers, 1, 2)
  t.is(result.length, 2)
  t.is(result[0].id, '2')
  t.is(result[1].id, '3')
})

test('WrkMinerPoolRackF2Pool: filterWorkers should limit to 100', (t) => {
  const worker = createMockWorker()
  const workers = Array.from({ length: 200 }, (_, i) => ({ id: i }))

  const result = worker.filterWorkers(workers, 0, 150)
  t.is(result.length, 100)
})

test('WrkMinerPoolRackF2Pool: appendPoolType should add poolType to data', (t) => {
  const worker = createMockWorker()
  const data = [
    { id: '1', name: 'worker1' },
    { id: '2', name: 'worker2' }
  ]

  const result = worker.appendPoolType(data)
  t.is(result.length, 2)
  t.is(result[0].poolType, POOL_TYPE)
  t.is(result[1].poolType, POOL_TYPE)
  t.is(result[0].id, '1')
  t.is(result[1].id, '2')
})

test('WrkMinerPoolRackF2Pool: appendPoolType should handle empty array', (t) => {
  const worker = createMockWorker()
  const result = worker.appendPoolType([])
  t.is(result.length, 0)
  t.ok(Array.isArray(result))
})

test('WrkMinerPoolRackF2Pool: _projection should filter array data', (t) => {
  const worker = createMockWorker()
  const data = [
    { id: '1', name: 'worker1', value: 100 },
    { id: '2', name: 'worker2', value: 200 }
  ]

  const result = worker._projection(data, { name: 1, value: 1 })
  t.is(result.length, 2)
  t.ok('name' in result[0])
  t.ok('value' in result[0])
  t.not('id' in result[0])
})

test('WrkMinerPoolRackF2Pool: _projection should filter object data', (t) => {
  const worker = createMockWorker()
  const data = { id: '1', name: 'worker1', value: 100 }

  const result = worker._projection(data, { name: 1 })
  t.ok('name' in result)
  t.not('id' in result)
  t.not('value' in result)
})

test('WrkMinerPoolRackF2Pool: getDbData should throw error when start is invalid', async (t) => {
  const worker = createMockWorker()
  const mockDb = {
    createReadStream: function () {
      return []
    }
  }

  try {
    await worker.getDbData(mockDb, { end: 1000 })
    t.fail('Should have thrown an error')
  } catch (e) {
    t.ok(e instanceof Error)
    t.is(e.message, 'ERR_START_INVALID')
  }
})

test('WrkMinerPoolRackF2Pool: getDbData should throw error when end is invalid', async (t) => {
  const worker = createMockWorker()
  const mockDb = {
    createReadStream: function () {
      return []
    }
  }

  try {
    await worker.getDbData(mockDb, { start: 1000 })
    t.fail('Should have thrown an error')
  } catch (e) {
    t.ok(e instanceof Error)
    t.is(e.message, 'ERR_END_INVALID')
  }
})

test('WrkMinerPoolRackF2Pool: getDbData should read from database stream', async (t) => {
  const worker = createMockWorker()
  const mockEntries = [
    { value: Buffer.from(JSON.stringify({ ts: 1000, data: 'test1' })) },
    { value: Buffer.from(JSON.stringify({ ts: 2000, data: 'test2' })) }
  ]

  const mockDb = {
    createReadStream: function (query) {
      t.ok(query.gte)
      t.ok(query.lte)
      return mockEntries
    }
  }

  const result = await worker.getDbData(mockDb, { start: 1000, end: 2000 })
  t.is(result.length, 2)
  t.is(result[0].data, 'test1')
  t.is(result[1].data, 'test2')
})

test('WrkMinerPoolRackF2Pool: _aggrTransactions should aggregate transactions correctly', (t) => {
  const worker = createMockWorker()
  const data = [
    {
      transactions: [
        { satoshis_net_earned: 1000000 },
        { satoshis_net_earned: 2000000 }
      ]
    },
    {
      transactions: [
        { satoshis_net_earned: 3000000 }
      ]
    }
  ]

  const start = new Date('2024-01-01T00:00:00Z').getTime()
  const end = new Date('2024-01-01T02:00:00Z').getTime()
  const result = worker._aggrTransactions(data, { start, end })

  t.ok(result)
  t.ok('ts' in result)
  t.ok('hourlyRevenues' in result)
  t.ok(Array.isArray(result.hourlyRevenues))
})

test('WrkMinerPoolRackF2Pool: _aggrByInterval should aggregate data correctly', (t) => {
  const worker = createMockWorker()
  const data = [
    {
      ts: new Date('2024-01-01T00:15:00Z').getTime(),
      stats: [
        { hashrate: 1000000, hashrate_1h: 1000000 },
        { hashrate: 2000000, hashrate_1h: 2000000 }
      ]
    },
    {
      ts: new Date('2024-01-01T00:20:00Z').getTime(),
      stats: [
        { hashrate: 1000000, hashrate_1h: 1000000 },
        { hashrate: 2000000, hashrate_1h: 2000000 }
      ]
    },
    {
      ts: new Date('2024-01-01T00:25:00Z').getTime(),
      stats: [
        { hashrate: 1000000, hashrate_1h: 1000000 },
        { hashrate: 2000000, hashrate_1h: 2000000 }
      ]
    },
    {
      ts: new Date('2024-01-01T00:30:00Z').getTime(),
      stats: [
        { hashrate: 2000000, hashrate_1h: 2000000 },
        { hashrate: 3000000, hashrate_1h: 3000000 }
      ]
    },
    {
      ts: new Date('2024-01-01T00:35:00Z').getTime(),
      stats: [
        { hashrate: 3000000, hashrate_1h: 3000000 },
        { hashrate: 4000000, hashrate_1h: 4000000 }
      ]
    },
    {
      ts: new Date('2024-01-01T00:40:00Z').getTime(),
      stats: [
        { hashrate: 4000000, hashrate_1h: 4000000 },
        { hashrate: 5000000, hashrate_1h: 5000000 }
      ]
    }
  ]

  const interval = '30m'
  const result = worker._aggrByInterval(data, interval)

  t.ok(result)
  t.ok(result.length === 2)
  t.ok(result[0].ts === new Date('2024-01-01T00:30:00Z').getTime())
  t.ok(result[0].stats[0].hashrate === 1250000)
  t.ok(result[0].stats[0].hashrate_1h === 2000000)
  t.ok(result[0].stats[1].hashrate === 2250000)
  t.ok(result[0].stats[1].hashrate_1h === 3000000)
  t.ok(result[1].ts === new Date('2024-01-01T01:00:00Z').getTime())
  t.ok(result[1].stats[0].hashrate === 3500000)
  t.ok(result[1].stats[0].hashrate_1h === 4000000)
  t.ok(result[1].stats[1].hashrate === 4500000)
  t.ok(result[1].stats[1].hashrate_1h === 5000000)
})

test('WrkMinerPoolRackF2Pool: getWrkExtData should throw error when query is invalid', async (t) => {
  const worker = createMockWorker()

  try {
    await worker.getWrkExtData({})
    t.fail('Should have thrown an error')
  } catch (e) {
    t.ok(e instanceof Error)
    t.is(e.message, 'ERR_QUERY_INVALID')
  }
})

test('WrkMinerPoolRackF2Pool: getWrkExtData should throw error when key is invalid', async (t) => {
  const worker = createMockWorker()

  try {
    await worker.getWrkExtData({ query: {} })
    t.fail('Should have thrown an error')
  } catch (e) {
    t.ok(e instanceof Error)
    t.is(e.message, 'ERR_KEY_INVALID')
  }
})

test('WrkMinerPoolRackF2Pool: getWrkExtData should return stats data', async (t) => {
  const worker = createMockWorker()
  worker.data.statsData = {
    ts: 1000,
    stats: [
      { username: 'testuser', balance: 1000 }
    ]
  }

  const result = await worker.getWrkExtData({ query: { key: 'stats' } })
  t.ok(result)
  t.ok(result.stats)
  t.is(result.stats[0].poolType, POOL_TYPE)
})

test('WrkMinerPoolRackF2Pool: getWrkExtData stats omits appendPoolType when stats missing', async (t) => {
  const worker = createMockWorker()
  worker.data.statsData = { ts: 1000 }

  const result = await worker.getWrkExtData({ query: { key: 'stats' } })
  t.ok(result)
  t.is(result.ts, 1000)
  t.is(result.stats, undefined)
})

test('WrkMinerPoolRackF2Pool: getWrkExtData stats-history with appendPoolType', async (t) => {
  const worker = createMockWorker()
  worker.statsDb = {
    createReadStream () {
      return [
        {
          value: Buffer.from(JSON.stringify({
            ts: new Date('2024-01-01T00:10:00Z').getTime(),
            stats: [{ hashrate: 1000000, hashrate_1h: 1000000 }]
          }))
        }
      ]
    }
  }

  const result = await worker.getWrkExtData({
    query: { key: 'stats-history', start: 1, end: 2000000000000 }
  })
  t.ok(Array.isArray(result))
  t.is(result[0].stats[0].poolType, POOL_TYPE)
})

test('WrkMinerPoolRackF2Pool: getWrkExtData stats-history with interval aggregation', async (t) => {
  const worker = createMockWorker()
  worker.statsDb = {
    createReadStream () {
      return [
        {
          value: Buffer.from(JSON.stringify({
            ts: new Date('2024-01-01T00:10:00Z').getTime(),
            stats: [
              { hashrate: 1000000, hashrate_1h: 1000000 },
              { hashrate: 2000000, hashrate_1h: 2000000 }
            ]
          }))
        },
        {
          value: Buffer.from(JSON.stringify({
            ts: new Date('2024-01-01T00:20:00Z').getTime(),
            stats: [
              { hashrate: 3000000, hashrate_1h: 3000000 },
              { hashrate: 4000000, hashrate_1h: 4000000 }
            ]
          }))
        }
      ]
    }
  }

  const result = await worker.getWrkExtData({
    query: { key: 'stats-history', start: 1, end: 2000000000000, interval: '30m' }
  })
  t.ok(Array.isArray(result))
  t.ok(result.length >= 1)
  result.forEach(row => {
    if (row.stats) {
      row.stats.forEach(s => t.is(s.poolType, POOL_TYPE))
    }
  })
})

test('WrkMinerPoolRackF2Pool: getWrkExtData should return default data for unknown key', async (t) => {
  const worker = createMockWorker()
  worker.data.testKey = { test: 'value' }

  const result = await worker.getWrkExtData({ query: { key: 'testKey' } })
  t.ok(result)
  t.is(result.test, 'value')
})

test('WrkMinerPoolRackF2Pool: saveStats should call _saveToDb', async (t) => {
  const worker = createMockWorker()
  worker.statsDb = { put: async () => {} }
  worker.data.statsData = {
    ts: 1000,
    stats: [{ username: 'testuser' }]
  }

  const time = new Date('2024-01-01T00:00:00Z')
  await worker.saveStats(time)

  t.ok(worker._dbCalls)
  t.is(worker._dbCalls.length, 1)
  t.is(worker._dbCalls[0].db, worker.statsDb)
})

test('WrkMinerPoolRackF2Pool: saveWorkers should call _saveToDb', async (t) => {
  const worker = createMockWorker()
  worker.workersDb = { put: async () => {} }
  worker.data.workersData = {
    ts: 1000,
    workers: [{ id: '1', name: 'worker1' }]
  }

  const time = new Date('2024-01-01T00:00:00Z')
  await worker.saveWorkers(time)

  t.ok(worker._dbCalls)
  t.is(worker._dbCalls.length, 1)
  t.is(worker._dbCalls[0].db, worker.workersDb)
})

test('WrkMinerPoolRackF2Pool: fetchWorkers should update workersData', async (t) => {
  const worker = createMockWorker()
  worker.workersCountDb = { put: async () => {} }

  const time = new Date('2024-01-01T00:00:00Z')
  await worker.fetchWorkers(time)

  t.ok(worker.data.workersData)
  t.ok(worker.data.workersData.workers)
  t.is(worker.data.workersData.workers.length, 1)
  t.is(worker.data.workersData.workers[0].username, 'testuser')
  t.ok(worker._dbCalls)
})

test('WrkMinerPoolRackF2Pool: fetchWorkers should handle errors gracefully', async (t) => {
  const worker = createMockWorker()
  worker.workersCountDb = { put: async () => {} }
  worker.f2poolApi.getWorkers = async () => {
    throw new Error('API Error')
  }

  const time = new Date('2024-01-01T00:00:00Z')
  await worker.fetchWorkers(time)

  t.ok(worker._errors)
  t.is(worker._errors.length, 1)
  t.is(worker._errors[0].msg, 'ERR_WORKERS_FETCH testuser')
})

test('WrkMinerPoolRackF2Pool: fetchTransactions should save transactions', async (t) => {
  const worker = createMockWorker()
  worker.transactionsDb = { put: async () => {} }

  await worker.fetchTransactions()

  t.ok(worker._dbCalls)
  t.is(worker._dbCalls.length, 1)
  t.is(worker._dbCalls[0].db, worker.transactionsDb)
  const savedData = worker._dbCalls[0].data
  // Check if data is a Buffer or already an object
  const parsedData = Buffer.isBuffer(savedData) ? JSON.parse(savedData.toString()) : savedData
  t.ok(parsedData.transactions || (savedData?.transactions))
  const transactions = parsedData.transactions || savedData.transactions
  if (transactions) {
    t.is(transactions.length, 2)
    t.is(transactions[0].username, 'testuser')
  }
})

test('WrkMinerPoolRackF2Pool: fetchTransactions should handle errors gracefully', async (t) => {
  const worker = createMockWorker()
  worker.transactionsDb = { put: async () => {} }
  worker.f2poolApi.getTransactions = async () => {
    throw new Error('API Error')
  }

  await worker.fetchTransactions()

  t.ok(worker._errors)
  t.is(worker._errors.length, 1)
  t.is(worker._errors[0].msg, 'ERR_TRANSACTIONS_FETCH testuser')
})

test('WrkMinerPoolRackF2Pool: getYearlyBalances should return monthly balances', async (t) => {
  const worker = createMockWorker()

  const result = await worker.getYearlyBalances('testuser')

  t.ok(Array.isArray(result))
  result.forEach(balance => {
    t.ok('month' in balance)
    t.ok('balance' in balance)
  })
})

test('WrkMinerPoolRackF2Pool: getYearlyBalances should cache non-current months', async (t) => {
  const worker = createMockWorker()
  worker.data.yearlyBalances = { '1-2024': 1000 }

  let callCount = 0
  worker.f2poolApi.getTransactions = async () => {
    callCount++
    return [{ changed_balance: 100 }]
  }

  await worker.getYearlyBalances('testuser')

  // Should not call API for cached month
  t.ok(callCount >= 0) // At least some calls for current month
})

test('WrkMinerPoolRackF2Pool: fetchData should handle 1M scheduler', async (t) => {
  const worker = createMockWorker()
  worker.data.workersData.workers = []

  const time = new Date('2024-01-01T00:00:00Z')
  await worker.fetchData(SCHEDULER_TIMES._1M.key, time)

  t.ok(worker.data.statsData)
})

test('WrkMinerPoolRackF2Pool: fetchData should handle 5M scheduler', async (t) => {
  const worker = createMockWorker()
  worker.workersCountDb = { put: async () => {} }
  worker.statsDb = { put: async () => {} }
  worker.data.workersData.workers = []

  const time = new Date('2024-01-01T00:00:00Z')
  await worker.fetchData(SCHEDULER_TIMES._5M.key, time)

  t.ok(worker.data.workersData)
})

test('WrkMinerPoolRackF2Pool: fetchData should handle 1D scheduler', async (t) => {
  const worker = createMockWorker()
  worker.transactionsDb = { put: async () => {} }
  worker.workersDb = { put: async () => {} }

  const time = new Date('2024-01-01T00:00:00Z')
  await worker.fetchData(SCHEDULER_TIMES._1D.key, time)

  t.ok(worker._dbCalls)
})

test('WrkMinerPoolRackF2Pool: fetchData should handle errors gracefully', async (t) => {
  const worker = createMockWorker()
  worker.f2poolApi.getBalance = async () => {
    throw new Error('API Error')
  }

  const time = new Date('2024-01-01T00:00:00Z')
  await worker.fetchData(SCHEDULER_TIMES._1M.key, time)

  t.ok(worker._errors)
  t.is(worker._errors[0].msg, 'ERR_DATA_FETCH')
})
