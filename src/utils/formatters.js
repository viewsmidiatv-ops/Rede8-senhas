const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']

export function padNumber(n, digits = 3) {
  return String(n).padStart(digits, '0')
}

export function formatTicket(ticket, categories) {
  if (!ticket) return '—'
  if (ticket.displayNumber) return ticket.displayNumber
  const cat = categories?.find(c => c.id === ticket.categoryId)
  const prefix = cat?.prefix || ''
  return prefix ? `${prefix}-${padNumber(ticket.number)}` : padNumber(ticket.number)
}

export function toArabicNumerals(n) {
  return String(n).replace(/\d/g, d => arabicDigits[d])
}

export function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'America/Bahia',
  })
}

export function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString('pt-BR', {
    timeZone: 'America/Bahia',
    year: 'numeric',
    month: '2-digit',
    day: 'numeric',
  })
}

export function estimateWait(ticketNumber, currentNumber, avgMinutes = 2) {
  const ahead = Math.max(0, ticketNumber - currentNumber)
  return ahead * avgMinutes
}
