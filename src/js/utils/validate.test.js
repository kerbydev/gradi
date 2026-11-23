import { describe, expect, it } from 'vitest'
import { validateAssessmentValues } from './validate.js'

const baseAssessment = {
  name: 'Quiz',
  category_id: 'category-1',
  input_method: 'raw',
  score: null,
  total_points: null,
  percentage: null,
  weight: 40,
  is_completed: false
}

describe('validateAssessmentValues', () => {
  it('allows an incomplete assessment without a score', () => {
    expect(validateAssessmentValues(baseAssessment)).toBe('')
    expect(validateAssessmentValues({
      ...baseAssessment,
      input_method: 'percent'
    })).toBe('')
  })

  it('enforces raw-score database checks', () => {
    expect(validateAssessmentValues({
      ...baseAssessment,
      score: 18,
      total_points: 20,
      is_completed: true
    })).toBe('')
    expect(validateAssessmentValues({
      ...baseAssessment,
      score: 18,
      is_completed: false
    })).toMatch(/both the score and total/i)
    expect(validateAssessmentValues({
      ...baseAssessment,
      score: 21,
      total_points: 20
    })).toMatch(/greater than total/i)
    expect(validateAssessmentValues({
      ...baseAssessment,
      is_completed: true
    })).toMatch(/before marking/i)
  })

  it('enforces percentage and weight bounds', () => {
    expect(validateAssessmentValues({
      ...baseAssessment,
      input_method: 'percent',
      percentage: 82.5,
      score: null,
      total_points: null,
      is_completed: true
    })).toBe('')
    expect(validateAssessmentValues({
      ...baseAssessment,
      input_method: 'percent',
      percentage: 101
    })).toMatch(/between 0 and 100/i)
    expect(validateAssessmentValues({
      ...baseAssessment,
      weight: -1
    })).toMatch(/weight must be between/i)
  })
})
