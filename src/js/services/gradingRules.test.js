import { describe, expect, it } from 'vitest'
import { inspectGradingRules, validateNumericGrade } from './gradingRules.js'

describe('grading rule coverage', () => {
  it('accepts contiguous percentage ranges with allowed grades', () => {
    expect(inspectGradingRules([
      { min_percent: 0, max_percent: 59.99, grade: 5 },
      { min_percent: 60, max_percent: 74.99, grade: 3 },
      { min_percent: 75, max_percent: 89.99, grade: 2 },
      { min_percent: 90, max_percent: 100, grade: 1 }
    ])).toEqual({ errors: [], overlaps: [], gaps: [] })
  })

  it('reports overlaps separately from uncovered ranges', () => {
    expect(inspectGradingRules([
      { min_percent: 0, max_percent: 60, grade: 5 },
      { min_percent: 59, max_percent: 80, grade: 3 },
      { min_percent: 85, max_percent: 95, grade: 2 }
    ])).toMatchObject({
      errors: [],
      overlaps: [expect.stringContaining('overlaps')],
      gaps: ['80.01%–84.99%', '95.01%–100.00%']
    })
  })

  it('reports missing coverage for an empty or partial table', () => {
    expect(inspectGradingRules([]).gaps).toEqual(['0.00%–100.00%'])
    expect(inspectGradingRules([
      { min_percent: 10, max_percent: 80, grade: 2 }
    ]).gaps).toEqual(['0.00%–9.99%', '80.01%–100.00%'])
  })
})

describe('validateNumericGrade', () => {
  it('allows only grades supported by the database', () => {
    expect(validateNumericGrade('1.25')).toBe('')
    expect(validateNumericGrade('3.25')).not.toBe('')
    expect(validateNumericGrade('')).not.toBe('')
  })
})
