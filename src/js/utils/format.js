export function formatNumber(value, decimals = 2) {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value)
}

export function formatPercent(value, decimals = 2) {
  return Number.isFinite(value) ? `${formatNumber(value, decimals)}%` : '—'
}

export function formatGrade(value, decimals = 2) {
  return Number.isFinite(value) ? formatNumber(value, decimals) : '—'
}

export function formatFinalGrade(finalGrade, emptyLabel = '—') {
  if (!finalGrade) return emptyLabel
  if (finalGrade.status) return finalGrade.status
  if (finalGrade.grade_value == null || finalGrade.grade_value === '') return emptyLabel
  const grade = Number(finalGrade.grade_value)
  return Number.isFinite(grade) ? formatGrade(grade) : emptyLabel
}

export function formatUnits(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return `${formatNumber(number, Number.isInteger(number) ? 0 : 2)} ${number === 1 ? 'unit' : 'units'}`
}

export function formatDate(value, options = {}) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options
  }).format(date)
}

export function formatGwa(value, decimals = 2) {
  const places = Number.isInteger(decimals) && decimals >= 0 ? decimals : 2
  return Number.isFinite(value) ? formatNumber(value, places) : '—'
}
