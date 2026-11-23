import { describe, expect, it } from 'vitest'
import { formatFinalGrade, formatGwa } from './format.js'

describe('formatGwa', () => {
  it('uses the configured decimal count', () => {
    expect(formatGwa(1.53125, 2)).toBe('1.53')
    expect(formatGwa(1.53125, 3)).toBe('1.531')
  })

  it('shows an em dash when there is no numeric GWA', () => {
    expect(formatGwa(null, 2)).toBe('—')
  })
})

describe('formatFinalGrade', () => {
  it('formats numeric grades and preserves non-numeric statuses', () => {
    expect(formatFinalGrade({ grade_value: 1.25 })).toBe('1.25')
    expect(formatFinalGrade({ status: 'INC', grade_value: null })).toBe('INC')
  })

  it('does not turn a missing or invalid grade into zero', () => {
    expect(formatFinalGrade({ grade_value: null }, 'No final grade')).toBe('No final grade')
    expect(formatFinalGrade({ grade_value: '' }, 'No final grade')).toBe('No final grade')
    expect(formatFinalGrade({ grade_value: 'unknown' }, 'No final grade')).toBe('No final grade')
  })
})
