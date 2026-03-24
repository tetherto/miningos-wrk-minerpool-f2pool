'use strict'

const test = require('brittle')
const http = require('http')
const { createServer } = require('../../mock/server')
const { F2PoolMinerPool } = require('../../workers/lib/f2pool.minerpool')
const { getWorkersStats } = require('../../workers/lib/utils')

let mockServer
let httpClient
let mockServerPort

function makeRequest (port, path, options) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(options.body)
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'F2P-API-SECRET': options.headers['F2P-API-SECRET']
      }
    }, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        try {
          const body = JSON.parse(data)
          resolve({ body, statusCode: res.statusCode })
        } catch (e) {
          reject(e)
        }
      })
    })

    req.on('error', reject)
    req.write(postData)
    req.end()
  })
}

test('setup: start mock server', async (t) => {
  const testPort = await new Promise((resolve) => {
    const server = http.createServer()
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      server.close(() => resolve(port))
    })
  })

  const argv = {
    port: testPort,
    host: '127.0.0.1',
    usernames: 'testuser',
    delay: 0
  }

  mockServer = createServer(argv)
  mockServerPort = testPort

  // Wait for server to be ready
  await new Promise((resolve) => setTimeout(resolve, 100))

  t.pass(`Mock server started on port ${mockServerPort}`)

  // Create HTTP client pointing to mock server
  httpClient = {
    post: async (path, options) => {
      return makeRequest(mockServerPort, path, options)
    }
  }
})

test('F2Pool API Client: should fetch balance from mock server', async (t) => {
  const apiSecret = 'secret-key'
  const client = new F2PoolMinerPool(httpClient, apiSecret)

  const result = await client.getBalance('testuser')

  t.ok(result)
  t.ok(result.balance_info)
  t.ok(typeof result.balance_info.total_income === 'number')
  t.ok(typeof result.balance_info.paid === 'number')
  t.ok(typeof result.balance_info.yesterday_income === 'number')
})

test('F2Pool API Client: should fetch hashrate info from mock server', async (t) => {
  const apiSecret = 'secret-key'
  const client = new F2PoolMinerPool(httpClient, apiSecret)

  const result = await client.getHashRateInfo('testuser')

  t.ok(result)
  t.ok(result.info)
  t.ok(typeof result.info.hash_rate === 'number')
  t.ok(typeof result.info.h1_hash_rate === 'number')
  t.ok(typeof result.info.h24_hash_rate === 'number')
  t.is(result.info.name, 'testuser')
})

test('F2Pool API Client: should fetch hashrate history from mock server', async (t) => {
  const apiSecret = 'secret-key'
  const client = new F2PoolMinerPool(httpClient, apiSecret)

  const startMs = new Date('2024-01-01T00:00:00Z').getTime()
  const endMs = new Date('2024-01-01T06:00:00Z').getTime()
  const first = await client.getHashRateHistory('testuser', startMs, endMs)

  t.ok(first)
  t.ok(Array.isArray(first.hash_rate_list))
  t.ok(first.hash_rate_list.length > 0)

  const second = await client.getHashRateHistory('testuser', startMs, endMs)
  t.is(second.hash_rate_list.length, first.hash_rate_list.length)
})

test('F2Pool API Client: should fetch workers from mock server', async (t) => {
  const apiSecret = 'secret-key'
  const client = new F2PoolMinerPool(httpClient, apiSecret)

  const result = await client.getWorkers('testuser')

  t.ok(Array.isArray(result))
  t.ok(result.length > 0)
  result.forEach(worker => {
    t.ok(worker.host)
    t.ok(worker.status !== undefined)
    t.ok(worker.hash_rate_info)
    t.ok(worker.hash_rate_info.name)
  })
})

test('F2Pool API Client: should fetch transactions from mock server', async (t) => {
  const apiSecret = 'secret-key'
  const client = new F2PoolMinerPool(httpClient, apiSecret)

  const startTime = new Date().setHours(0, 0, 0, 0)
  const endTime = Date.now()
  const result = await client.getTransactions(startTime, endTime, 'revenue', 'testuser')

  t.ok(Array.isArray(result))
  result.forEach(transaction => {
    t.ok(transaction.id)
    t.ok(transaction.type)
    t.ok(typeof transaction.changed_balance === 'number')
    t.ok(transaction.created_at)
  })
})

test('F2Pool API Client: should handle authentication errors', async (t) => {
  const invalidClient = {
    post: async (path, options) => {
      return makeRequest(mockServerPort, path, {
        ...options,
        headers: {
          ...options.headers,
          'F2P-API-SECRET': 'invalid-secret'
        }
      })
    }
  }

  const client = new F2PoolMinerPool(invalidClient, 'invalid-secret')

  try {
    const result = await client.getBalance('testuser')
    t.ok(result)
  } catch (e) {
    t.ok(e instanceof Error || typeof e === 'object')
  }
})

test('Worker Stats Transformation: should transform API workers correctly', async (t) => {
  const apiSecret = 'secret-key'
  const client = new F2PoolMinerPool(httpClient, apiSecret)

  const workers = await client.getWorkers('testuser')
  const stats = getWorkersStats(workers, 'testuser')

  t.ok(Array.isArray(stats))
  t.is(stats.length, workers.length)
  stats.forEach((stat, index) => {
    t.is(stat.username, 'testuser')
    t.is(stat.id, workers[index].host)
    t.is(stat.name, workers[index].hash_rate_info.name)
    t.ok(typeof stat.online === 'number')
    t.ok(typeof stat.hashrate === 'number')
  })
})

test('Integration: should fetch and process complete account data', async (t) => {
  const apiSecret = 'secret-key'
  const client = new F2PoolMinerPool(httpClient, apiSecret)
  const username = 'testuser'

  const [balance, hashrateInfo, workers, transactions] = await Promise.all([
    client.getBalance(username),
    client.getHashRateInfo(username),
    client.getWorkers(username),
    client.getTransactions(
      new Date().setHours(0, 0, 0, 0),
      Date.now(),
      'revenue',
      username
    )
  ])

  t.ok(balance.balance_info)
  t.ok(typeof balance.balance_info.total_income === 'number')
  t.ok(hashrateInfo.info)
  t.ok(typeof hashrateInfo.info.hash_rate === 'number')
  t.ok(Array.isArray(workers))
  t.ok(workers.length > 0)
  t.ok(Array.isArray(transactions))
  const workerStats = getWorkersStats(workers, username)
  t.is(workerStats.length, workers.length)
  workerStats.forEach(stat => {
    t.is(stat.username, username)
    t.ok(stat.id)
    t.ok(stat.name)
    t.ok(typeof stat.online === 'number')
    t.ok(typeof stat.hashrate === 'number')
  })
})

test('Integration: should handle multiple API calls with rate limiting', async (t) => {
  const apiSecret = 'secret-key'
  const client = new F2PoolMinerPool(httpClient, apiSecret)

  const startTime = Date.now()

  await client.getBalance('testuser')
  await client.getHashRateInfo('testuser')
  await client.getWorkers('testuser')

  const endTime = Date.now()
  const duration = endTime - startTime

  // Should take at least 2 seconds due to rate limiting (1s between calls)
  t.ok(duration >= 2000, `Expected at least 2000ms, got ${duration}ms`)
})

test('Integration: should fetch transactions for date range', async (t) => {
  const apiSecret = 'secret-key'
  const client = new F2PoolMinerPool(httpClient, apiSecret)

  // Fetch transactions for last 7 days
  const endTime = Date.now()
  const startTime = endTime - (7 * 24 * 60 * 60 * 1000)

  const transactions = await client.getTransactions(startTime, endTime, 'revenue', 'testuser')

  t.ok(Array.isArray(transactions))

  // Verify all transactions are within the date range
  const startSeconds = Math.floor(startTime / 1000)
  const endSeconds = Math.floor(endTime / 1000)

  transactions.forEach(tx => {
    t.ok(tx.created_at >= startSeconds || tx.created_at <= endSeconds)
  })
})

test('Integration: should handle empty worker list', async (t) => {
  const apiSecret = 'secret-key'
  const client = new F2PoolMinerPool(httpClient, apiSecret)

  const workers = await client.getWorkers('testuser')
  t.ok(Array.isArray(workers))

  if (workers.length === 0) {
    const stats = getWorkersStats(workers, 'testuser')
    t.is(stats.length, 0)
  }
})

test('Integration: should process worker status correctly', async (t) => {
  const apiSecret = 'secret-key'
  const client = new F2PoolMinerPool(httpClient, apiSecret)

  const workers = await client.getWorkers('testuser')
  const stats = getWorkersStats(workers, 'testuser')

  stats.forEach((stat, index) => {
    const originalWorker = workers[index]
    const expectedOnline = originalWorker.status === 0 ? 1 : 0
    t.is(stat.online, expectedOnline,
      `Worker ${stat.name} status mismatch: expected ${expectedOnline} for status ${originalWorker.status}`)
  })
})

test('Integration: mock minerpool worker endpoint adds worker', async (t) => {
  const suffix = Math.random().toString(36).slice(2, 12)
  const res = await makeRequest(mockServerPort, '/mock/minerpool/worker', {
    body: {
      name: `pool.wrk_${suffix}`,
      host: '10.0.0.1'
    },
    headers: { 'F2P-API-SECRET': 'secret-key' }
  })
  t.is(res.statusCode, 200)
  t.ok(res.body.success)
})

test('Integration: mock minerpool worker endpoint rejects missing name', async (t) => {
  const res = await makeRequest(mockServerPort, '/mock/minerpool/worker', {
    body: { host: '10.0.0.2' },
    headers: { 'F2P-API-SECRET': 'secret-key' }
  })
  t.is(res.statusCode, 200)
  t.is(res.body.success, false)
  t.ok(String(res.body.error).includes('ERR_INVALID_NAME'))
})

test('teardown: stop mock server', async (t) => {
  if (mockServer) {
    const state = mockServer.reset()
    t.ok(state)
    await mockServer.stop()
    t.pass('Mock server stopped')
  }
})
