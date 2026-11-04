// Shared by reception, display and server so the preview matches the next call.
export function compareQueuedTickets(a, b) {
  const forced = Number(Boolean(b.forcedCounterId)) - Number(Boolean(a.forcedCounterId))
  const priority = Number(b.categoryId === 'priority') - Number(a.categoryId === 'priority')
  return forced || priority || a.number - b.number
}
