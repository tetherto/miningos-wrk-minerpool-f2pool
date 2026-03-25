'use strict'

const test = require('brittle')
const { getMiningPoolUserName, getAvailableCurrency } = require('../../mock/lib')

test('getMiningPoolUserName returns mapped name', (t) => {
  t.is(getMiningPoolUserName('haven7346'), 'haven7346')
})

test('getMiningPoolUserName returns undefined for unknown', (t) => {
  t.is(getMiningPoolUserName('unknown'), undefined)
})

test('getAvailableCurrency returns mapped currency', (t) => {
  t.is(getAvailableCurrency('bitcoin'), 'bitcoin')
})

test('getAvailableCurrency returns undefined for unknown', (t) => {
  t.is(getAvailableCurrency('doge'), undefined)
})
