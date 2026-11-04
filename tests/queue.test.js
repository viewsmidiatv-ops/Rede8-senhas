import test from 'node:test'
import assert from 'node:assert/strict'
import { takeTicket, callNext, completeTicket, recallTicket, skipTicket } from '../server/store.js'
import { CLINIC_COUNTERS, CLINIC_CATEGORIES } from '../server/clinic-setup.js'
import { compareQueuedTickets } from '../src/utils/queueOrder.js'
import { t, getLangCode } from '../src/utils/i18n.js'

function fixture() {
  return { counters: structuredClone(CLINIC_COUNTERS), categories: structuredClone(CLINIC_CATEGORIES), tickets: [], nextTicketNumber: 1 }
}

test('priority is called first; FIFO is preserved within each type; two counters never receive the same ticket', () => {
  const s = fixture()
  const n1 = takeTicket(s, 'normal')
  const n2 = takeTicket(s, 'normal')
  const p1 = takeTicket(s, 'priority')
  const p2 = takeTicket(s, 'priority')
  assert.equal(n1.displayNumber, 'N-001')
  assert.equal(p1.displayNumber, 'P-003')
  assert.deepEqual([...s.tickets].sort(compareQueuedTickets), [p1, p2, n1, n2])
  assert.equal(callNext(s, 1), p1)
  assert.equal(callNext(s, 2), p2)
  assert.equal(recallTicket(s, 1), p1)
  assert.equal(completeTicket(s, 1).status, 'served')
  assert.equal(callNext(s, 1), n1)
  assert.equal(callNext(s, 2), n2)
  assert.equal(p2.status, 'served')
  assert.equal(skipTicket(s, 1).status, 'skipped')
})

test('invalid category does not consume a number; a closed counter cannot call', () => {
  const s = fixture()
  assert.equal(takeTicket(s, 'unknown'), null)
  assert.equal(s.nextTicketNumber, 1)
  takeTicket(s, 'normal')
  s.counters[0].status = 'closed'
  assert.equal(callNext(s, 1), null)
  assert.equal(s.tickets[0].status, 'waiting')
})

test('counter category filters and explicit transfers still take precedence', () => {
  const s = fixture()
  const n = takeTicket(s, 'normal')
  const p = takeTicket(s, 'priority')
  s.counters[0].categoryIds = ['normal']
  assert.equal(callNext(s, 1), n)
  assert.equal(callNext(s, 2), p)
  const nextNormal = takeTicket(s, 'normal')
  const nextPriority = takeTicket(s, 'priority')
  nextNormal.forcedCounterId = 2
  assert.equal(callNext(s, 2), nextNormal)
  assert.equal(nextPriority.status, 'waiting')
})

test('Portuguese announcements keep the printed prefix and counter name', () => {
  assert.equal(getLangCode('pt'), 'pt-BR')
  assert.equal(t('voiceNowServing', 'pt', { n: 'P-003', counter: 'Guichê 2' }), 'Senha P-003, dirija-se ao Guichê 2.')
})
