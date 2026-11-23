import { describe, expect, it } from 'vitest'
import { calculateGwa, computeCumulativeGwa, computeGwa } from './gwaCalculator.js'

describe('computeGwa', () => {
  const subjects = [
    { id: 'a', name: 'Course A', units: 3, counts_in_gwa: true, final_grade: { grade_value: 1.25 } },
    { id: 'b', name: 'Course B', units: 3, counts_in_gwa: true, final_grade: { grade_value: 1.5 } },
    { id: 'c', name: 'Course C', units: 2, counts_in_gwa: true, final_grade: { grade_value: 2 } },
    { id: 'd', name: 'Incomplete', units: 3, counts_in_gwa: true, final_grade: { status: 'INC' } }
  ]

  it('matches the reference GWA and excludes INC units', () => {
    const result = computeGwa(subjects)
    expect(result.gwa).toBeCloseTo(1.53125)
    expect(result.totalUnitsCounted).toBe(8)
    expect(result.totalUnitsUncounted).toBe(3)
    expect(result.uncounted).toHaveLength(1)
    expect(result.uncounted[0]).toMatchObject({ subjectId: 'd', name: 'Incomplete', reason: 'status' })
  })

  it('lists excluded, missing-grade, and invalid-unit subjects as uncounted', () => {
    const result = computeGwa([
      { id: 'excluded', units: 2, counts_in_gwa: false, final_grade: { grade_value: 1.25 } },
      { id: 'no-grade', units: 3, final_grade: null },
      { id: 'bad-units', units: 0, final_grade: { grade_value: 2 } },
      { id: 'bad-grade', units: 2, final_grade: { grade_value: 6 } }
    ])
    expect(result.gwa).toBeNull()
    expect(result.totalUnitsCounted).toBe(0)
    expect(result.totalUnitsUncounted).toBe(7)
    expect(result.uncounted.map(row => row.reason)).toEqual([
      'excluded_by_setting',
      'missing_or_invalid_grade',
      'invalid_units',
      'missing_or_invalid_grade'
    ])
  })

  it('supports flat numeric grade values and keeps the legacy dashboard fields', () => {
    expect(computeGwa([{ units: '2', grade_value: '1.5' }]).gwa).toBe(1.5)
    expect(calculateGwa(subjects)).toMatchObject({
      gwa: expect.closeTo(1.53125),
      countedUnits: 8,
      uncountedCount: 1,
      uncountedUnits: 3
    })
  })

  it('never treats non-numeric final statuses as numeric zero grades', () => {
    const result = computeGwa([
      { units: 3, final_grade: { status: 'INC' } },
      { units: 3, final_grade: { status: 'IP' } },
      { units: 3, final_grade: { status: 'DR' } },
      { units: 3, final_grade: { status: 'WDRW' } }
    ])
    expect(result.gwa).toBeNull()
    expect(result.totalUnitsCounted).toBe(0)
    expect(result.uncounted.map(subject => subject.reason)).toEqual(['status', 'status', 'status', 'status'])
  })
})

describe('computeCumulativeGwa', () => {
  it('weights all semesters together by units', () => {
    const result = computeCumulativeGwa([
      { units: 3, final_grade: { grade_value: 1 } },
      { units: 1, final_grade: { grade_value: 3 } }
    ])
    expect(result.gwa).toBe(1.5)
    expect(result.totalUnitsCounted).toBe(4)
  })

  it('calculates across raw rows from two semesters and excludes INC rather than averaging semester GWAs', () => {
    const firstSemester = [
      { units: 3, final_grade: { grade_value: 1.25 } },
      { units: 3, final_grade: { grade_value: 1.5 } },
      { units: 2, final_grade: { grade_value: 2 } },
      { units: 3, final_grade: { status: 'INC' } }
    ]
    const secondSemester = [
      { units: 1, final_grade: { grade_value: 3 } },
      { units: 3, final_grade: { grade_value: 2.5 } }
    ]
    const firstGwa = computeGwa(firstSemester).gwa
    const secondGwa = computeGwa(secondSemester).gwa
    const result = computeCumulativeGwa([...firstSemester, ...secondSemester])

    expect(firstGwa).toBeCloseTo(1.53125)
    expect(secondGwa).toBe(2.625)
    expect(result.gwa).toBeCloseTo(1.8958333333)
    expect(result.totalUnitsCounted).toBe(12)
    expect(result.totalUnitsUncounted).toBe(3)
    expect(result.uncounted[0]).toMatchObject({ status: 'INC', reason: 'status' })
  })
})
