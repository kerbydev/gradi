import { describe, expect, it } from 'vitest'
import {
  calculateCategory,
  calculateIndividual,
  computeAssessmentPercentage,
  computeSubjectGrade,
  convertPercentToGrade
} from './gradeCalculator.js'

describe('computeAssessmentPercentage', () => {
  it('handles percentage and raw-score assessment inputs', () => {
    expect(computeAssessmentPercentage({ input_method: 'percent', percentage: 82.5 })).toBe(82.5)
    expect(computeAssessmentPercentage({ input_method: 'raw', score: 18, total_points: 20 })).toBe(90)
    expect(computeAssessmentPercentage({ input_method: 'raw', score: 0, total_points: 5 })).toBe(0)
  })

  it.each([
    [{ input_method: 'percent', percentage: -1 }],
    [{ input_method: 'percent', percentage: 101 }],
    [{ input_method: 'percent', percentage: null }],
    [{ input_method: 'raw', score: -1, total_points: 10 }],
    [{ input_method: 'raw', score: 10, total_points: 0 }],
    [{ input_method: 'raw', score: 11, total_points: 10 }],
    [null]
  ])('returns null for invalid assessment input %#', assessment => {
    expect(computeAssessmentPercentage(assessment)).toBeNull()
  })
})

describe('individual weighting', () => {
  const assessments = [
    { input_method: 'percent', percentage: 90, weight: 10, is_completed: true },
    { input_method: 'percent', percentage: 85, weight: 10, is_completed: true },
    { input_method: 'percent', percentage: 95, weight: 20, is_completed: true },
    { input_method: 'percent', percentage: 80, weight: 20, is_completed: true },
    { input_method: 'percent', percentage: null, weight: 40, is_completed: false }
  ]

  it('matches the reference vector without counting incomplete work', () => {
    const result = computeSubjectGrade({ weighting_mode: 'individual' }, [], assessments)
    expect(result.earned).toBeCloseTo(52.5)
    expect(result.completedWeight).toBe(60)
    expect(result.remainingWeight).toBe(40)
    expect(result.totalConfiguredWeight).toBe(100)
    expect(result.currentAverage).toBeCloseTo(87.5)
    expect(result.weightWarnings).toEqual([])
  })

  it('warns about malformed scores and invalid or incomplete weight totals', () => {
    const result = computeSubjectGrade({ weighting_mode: 'individual' }, [], [
      { name: 'Bad score', input_method: 'percent', percentage: 120, weight: -5, is_completed: true },
      { name: 'Pending', input_method: 'percent', percentage: 40, weight: 25, is_completed: false }
    ])
    expect(result.earned).toBe(0)
    expect(result.completedWeight).toBe(0)
    expect(result.remainingWeight).toBe(25)
    expect(result.weightWarnings).toHaveLength(3)
    expect(result.weightWarnings.join(' ')).toMatch(/invalid weight/i)
    expect(result.weightWarnings.join(' ')).toMatch(/expected 100%/i)
  })

  it('retains the legacy individual API for existing pages', () => {
    expect(calculateIndividual(assessments).earned).toBeCloseTo(52.5)
    expect(calculateIndividual(assessments).weightsValid).toBe(true)
  })
})

describe('category weighting', () => {
  it('matches the reference quizzes vector and counts category weights only once', () => {
    const assessments = [
      { id: 'q1', category_id: 'quiz', input_method: 'percent', percentage: 80, weight: 40, is_completed: true },
      { id: 'q2', category_id: 'quiz', input_method: 'percent', percentage: 90, weight: 60, is_completed: true }
    ]
    const result = computeSubjectGrade({ weighting_mode: 'category' }, [{ id: 'quiz', name: 'Quizzes', weight: 20 }], assessments)
    expect(result.earned).toBeCloseTo(17.2)
    expect(result.completedWeight).toBeCloseTo(20)
    expect(result.remainingWeight).toBeCloseTo(0)
    expect(result.totalConfiguredWeight).toBe(20)
    expect(result.perCategory).toEqual([{
      categoryId: 'quiz',
      name: 'Quizzes',
      configuredWeight: 20,
      earned: expect.closeTo(17.2),
      completedWeight: expect.closeTo(20),
      remainingWeight: expect.closeTo(0),
      currentAverage: expect.closeTo(86)
    }])
    expect(calculateCategory(assessments, [{ id: 'quiz', weight: 20 }]).earned).toBeCloseTo(17.2)
  })

  it('uses only completed relative weights when a category item is incomplete', () => {
    const assessments = [
      { category_id: 'quiz', input_method: 'percent', percentage: 80, weight: 40, is_completed: true },
      { category_id: 'quiz', input_method: 'percent', percentage: null, weight: 60, is_completed: false }
    ]
    const result = computeSubjectGrade({ weighting_mode: 'category' }, [{ id: 'quiz', weight: 20 }], assessments)
    expect(result.earned).toBeCloseTo(6.4)
    expect(result.completedWeight).toBeCloseTo(8)
    expect(result.remainingWeight).toBeCloseTo(12)
    expect(result.perCategory[0].remainingWeight).toBeCloseTo(12)
  })

  it('uses equal relative weights when all assessment weights are zero', () => {
    const result = computeSubjectGrade({ weighting_mode: 'category' }, [{ id: 'lab', weight: 30 }], [
      { category_id: 'lab', input_method: 'percent', percentage: 50, weight: 0 },
      { category_id: 'lab', input_method: 'percent', percentage: 100, weight: 0 }
    ])
    expect(result.earned).toBeCloseTo(22.5)
    expect(result.completedWeight).toBe(30)
  })

  it('warns when an assessment is outside configured categories', () => {
    const result = computeSubjectGrade({ weighting_mode: 'category' }, [], [
      { category_id: 'missing', input_method: 'percent', percentage: 75, weight: 100 }
    ])
    expect(result.earned).toBe(0)
    expect(result.weightWarnings.join(' ')).toMatch(/no matching category/i)
  })
})

describe('grade conversion', () => {
  const rules = [
    { min_percent: 0, max_percent: 59.99, grade: 5 },
    { min_percent: 60, max_percent: 74.99, grade: 3 },
    { min_percent: 75, max_percent: 89.99, grade: 2 },
    { min_percent: 90, max_percent: 100, grade: 1 }
  ]

  it('returns the matched rule on boundaries and null for invalid or unmatched values', () => {
    expect(convertPercentToGrade(90, rules)).toEqual({ grade: 1, matchedRule: rules[3] })
    expect(convertPercentToGrade(74.99, rules).grade).toBe(3)
    expect(convertPercentToGrade(101, rules)).toEqual({ grade: null, matchedRule: null })
    expect(convertPercentToGrade(50, [])).toEqual({ grade: null, matchedRule: null })
  })
})
