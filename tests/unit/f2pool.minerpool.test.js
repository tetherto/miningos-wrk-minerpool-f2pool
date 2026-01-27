'use strict'

const test = require('brittle')
const { F2PoolMinerPool } = require('../../workers/lib/f2pool.minerpool')
const { CURRENCY } = require('../../workers/lib/constants')

test('F2PoolMinerPool: should initialize with http and apiSecret', (t) => {
  const mockHttp = {}
  const apiSecret = 'test-secret'

  const client = new F2PoolMinerPool(mockHttp, apiSecret)

  t.is(client._http, mockHttp)
  t.is(client.apiSecret, apiSecret)
})

test('F2PoolMinerPool: getBalance should call _request with correct parameters', async (t) => {
  const mockHttp = {
    post: async (path, options) => {
      t.is(path, '/v2/assets/balance')
      t.is(options.headers['F2P-API-SECRET'], 'test-secret')
      t.is(options.encoding, 'json')
      t.is(options.body.mining_user_name, 'testuser')
      t.is(options.body.currency, CURRENCY)
      return {
        body: {
          balance_info: {
            total_income: 1000,
            paid: 500
          }
        }
      }
    }
  }

  const client = new F2PoolMinerPool(mockHttp, 'test-secret')
  const result = await client.getBalance('testuser')

  t.ok(result)
  t.ok(result.balance_info)
  t.is(result.balance_info.total_income, 1000)
})

test('F2PoolMinerPool: getHashRateInfo should call _request with correct parameters', async (t) => {
  const mockHttp = {
    post: async (path, options) => {
      t.is(path, '/v2/hash_rate/info')
      t.is(options.body.mining_user_name, 'testuser')
      t.is(options.body.currency, CURRENCY)
      return {
        body: {
          info: {
            hash_rate: 100,
            h1_hash_rate: 95,
            h24_hash_rate: 90
          }
        }
      }
    }
  }

  const client = new F2PoolMinerPool(mockHttp, 'test-secret')
  const result = await client.getHashRateInfo('testuser')

  t.ok(result)
  t.ok(result.info)
  t.is(result.info.hash_rate, 100)
})

test('F2PoolMinerPool: getWorkers should return empty array when workers is undefined', async (t) => {
  const mockHttp = {
    post: async () => {
      return {
        body: {}
      }
    }
  }

  const client = new F2PoolMinerPool(mockHttp, 'test-secret')
  const result = await client.getWorkers('testuser')

  t.ok(Array.isArray(result))
  t.is(result.length, 0)
})

test('F2PoolMinerPool: getTransactions should call _request with correct parameters', async (t) => {
  const startTime = new Date('2024-01-01T00:00:00Z').getTime()
  const endTime = new Date('2024-01-01T23:59:59Z').getTime()
  const mockTransactions = [
    { id: '1', changed_balance: 100 },
    { id: '2', changed_balance: 200 }
  ]

  const mockHttp = {
    post: async (path, options) => {
      t.is(path, '/v2/assets/transactions/list')
      t.is(options.body.mining_user_name, 'testuser')
      t.is(options.body.currency, CURRENCY)
      t.is(options.body.type, 'revenue')
      t.ok(options.body.start_time)
      t.ok(options.body.end_time)
      return {
        body: {
          transactions: mockTransactions
        }
      }
    }
  }

  const client = new F2PoolMinerPool(mockHttp, 'test-secret')
  const result = await client.getTransactions(startTime, endTime, 'revenue', 'testuser')

  t.ok(Array.isArray(result))
  t.is(result.length, 2)
  t.is(result[0].id, '1')
})

test('F2PoolMinerPool: getTransactions should return empty array when transactions is undefined', async (t) => {
  const startTime = new Date('2024-01-01T00:00:00Z').getTime()
  const endTime = new Date('2024-01-01T23:59:59Z').getTime()

  const mockHttp = {
    post: async () => {
      return {
        body: {}
      }
    }
  }

  const client = new F2PoolMinerPool(mockHttp, 'test-secret')
  const result = await client.getTransactions(startTime, endTime, 'revenue', 'testuser')

  t.ok(Array.isArray(result))
  t.is(result.length, 0)
})

test('F2PoolMinerPool: _request should include timeout', async (t) => {
  const mockHttp = {
    post: async (path, options) => {
      t.is(options.timeout, 30 * 1000)
      return {
        body: {}
      }
    }
  }

  const client = new F2PoolMinerPool(mockHttp, 'test-secret')
  await client.getBalance('testuser')
})

test('F2PoolMinerPool: _request should handle errors', async (t) => {
  const mockHttp = {
    post: async () => {
      throw new Error('API Error')
    }
  }

  const client = new F2PoolMinerPool(mockHttp, 'test-secret')

  try {
    await client.getBalance('testuser')
    t.fail('Should have thrown an error')
  } catch (e) {
    t.ok(e instanceof Error)
    t.is(e.message, 'API Error')
  }
})
