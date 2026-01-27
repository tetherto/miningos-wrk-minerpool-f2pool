'use strict'

const test = require('brittle')
const {
  getWorkersStats,
  getMonthlyDateRanges,
  isCurrentMonth,
  convertMsToSeconds,
  getTimeRanges
} = require('../../workers/lib/utils')
const crypto = require('crypto')
const randomIP = () => [...crypto.randomBytes(4)].join('.')

test('getWorkersStats: should transform workers array correctly', (t) => {
  const workers = [
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
    },
    {
      host: randomIP(),
      status: 1,
      last_share_at: '2024-01-01T01:00:00Z',
      hash_rate_info: {
        name: 'worker2',
        hash_rate: 200,
        h1_hash_rate: 195,
        h24_hash_rate: 190,
        h1_stale_hash_rate: 10,
        h24_stale_hash_rate: 20
      }
    }
  ]

  const username = 'testuser'
  const result = getWorkersStats(workers, username)

  t.is(result.length, 2)
  t.is(result[0].username, username)
  t.is(result[0].name, 'worker1')
  t.is(result[0].online, 1) // status 0 means online
  t.is(result[0].last_updated, '2024-01-01T00:00:00Z')
  t.is(result[0].hashrate, 100)
  t.is(result[0].hashrate_1h, 95)
  t.is(result[0].hashrate_24h, 90)
  t.is(result[0].hashrate_stale_1h, 5)
  t.is(result[0].hashrate_stale_24h, 10)
  t.is(result[1].online, 0)
})

test('getWorkersStats: should handle empty array', (t) => {
  const result = getWorkersStats([], 'testuser')
  t.is(result.length, 0)
  t.ok(Array.isArray(result))
})

test('getWorkersStats: should handle status as string', (t) => {
  const workers = [
    {
      host: randomIP(),
      status: '0',
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
  ]

  const result = getWorkersStats(workers, 'testuser')
  t.is(result[0].online, 1)
})

test('getMonthlyDateRanges: should generate correct date ranges', (t) => {
  const months = 3
  const result = getMonthlyDateRanges(months)

  t.ok(typeof result === 'object')
  const keys = Object.keys(result)
  t.is(keys.length, 3)

  // Check that each key is in format "month-year"
  keys.forEach(key => {
    t.ok(/^\d+-\d+$/.test(key))
    const [month, year] = key.split('-').map(Number)
    t.ok(month >= 1 && month <= 12)
    t.ok(year > 0)
  })

  // Check that each entry has startDate and endDate
  Object.values(result).forEach(range => {
    t.ok('startDate' in range)
    t.ok('endDate' in range)
    t.ok(typeof range.startDate === 'number')
    t.ok(typeof range.endDate === 'number')
    t.ok(range.endDate > range.startDate)
  })
})

test('getMonthlyDateRanges: should handle zero months', (t) => {
  const result = getMonthlyDateRanges(0)
  t.is(Object.keys(result).length, 0)
})

test('getMonthlyDateRanges: should handle single month', (t) => {
  const result = getMonthlyDateRanges(1)
  t.is(Object.keys(result).length, 1)
})

test('isCurrentMonth: should return true for current month', (t) => {
  const now = new Date()
  const currentMonth = `${now.getMonth() + 1}-${now.getFullYear()}`
  t.ok(isCurrentMonth(currentMonth))
})

test('isCurrentMonth: should return false for different month', (t) => {
  const now = new Date()
  const differentMonth = now.getMonth() === 0 ? '12-2023' : `${now.getMonth()}-${now.getFullYear()}`
  t.not(isCurrentMonth(differentMonth))
})

test('isCurrentMonth: should handle month format correctly', (t) => {
  const result = isCurrentMonth('1-2024')
  t.ok(typeof result === 'boolean')
})

test('convertMsToSeconds: should convert milliseconds to seconds', (t) => {
  t.is(convertMsToSeconds(1000), 1)
  t.is(convertMsToSeconds(5000), 5)
  t.is(convertMsToSeconds(60000), 60)
  t.is(convertMsToSeconds(3600000), 3600)
})

test('convertMsToSeconds: should floor the result', (t) => {
  t.is(convertMsToSeconds(1500), 1)
  t.is(convertMsToSeconds(1999), 1)
  t.is(convertMsToSeconds(2000), 2)
})

test('convertMsToSeconds: should handle zero', (t) => {
  t.is(convertMsToSeconds(0), 0)
})

test('getTimeRanges: should return empty array when start >= end', (t) => {
  const start = 1000
  const end = 1000
  t.is(getTimeRanges(start, end).length, 0)

  const start2 = 2000
  const end2 = 1000
  t.is(getTimeRanges(start2, end2).length, 0)
})

test('getTimeRanges: should generate hourly ranges by default', (t) => {
  const start = new Date('2024-01-01T00:00:00Z').getTime()
  const end = new Date('2024-01-01T03:00:00Z').getTime()
  const result = getTimeRanges(start, end)

  t.ok(result.length > 0)
  result.forEach(range => {
    t.ok('start' in range)
    t.ok('end' in range)
    t.ok(range.end > range.start)
  })
})

test('getTimeRanges: should generate hourly ranges when isHourly is true', (t) => {
  const start = new Date('2024-01-01T00:00:00Z').getTime()
  const end = new Date('2024-01-01T02:00:00Z').getTime()
  const result = getTimeRanges(start, end, true)

  t.ok(result.length > 0)
  result.forEach(range => {
    const diff = range.end - range.start
    t.ok(diff <= 60 * 60 * 1000 + 1000)
  })
})

test('getTimeRanges: should generate daily ranges when isHourly is false', (t) => {
  const start = new Date('2024-01-01T00:00:00Z').getTime()
  const end = new Date('2024-01-03T00:00:00Z').getTime()
  const result = getTimeRanges(start, end, false)

  t.ok(result.length > 0)
  result.forEach(range => {
    const diff = range.end - range.start
    t.ok(diff <= 24 * 60 * 60 * 1000 + 1000)
  })
})
