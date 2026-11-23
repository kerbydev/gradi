import { describe, expect, it } from 'vitest'
import { computeSubjectGrade } from './gradeCalculator.js'
import {
  predictFinal,
  predictGrade,
  requiredScoreForTarget
} from './gradePredictor.js'

describe('predictFinal', () => {
  const result = computeSubjectGrade({ weighting_mode: 'individual' }, [], [
    { input_method: 'percent', percentage: 80, weight: 40, is_completed: true },
    { input_method: 'percent', percentage: null, weight: 60, is_completed: false }
  ])

  it('projects a uniform hypothetical score across all remaining weight', () => {
    const prediction = predictFinal(result, 90)
    expect(prediction.projectedFinal).toBeCloseTo(86)
    expect(prediction.hypotheticalEarned).toBeCloseTo(54)
    expect(prediction.projectedWeight).toBe(60)
    expect(prediction.projectedAverage).toBeCloseTo(86)
  })

  it('accepts a weighted set of hypothetical assessments', () => {
    const prediction = predictFinal(result, [
      { percent: 80, weight: 20 },
      { percent: 100, weight: 40 }
    ])
    expect(prediction.projectedFinal).toBeCloseTo(88)
    expect(prediction.projectedWeight).toBe(60)
  })

  it('applies category hypotheticals only to the matching category remaining weight', () => {
    const categoryResult = computeSubjectGrade({ weighting_mode: 'category' }, [
      { id: 'quiz', name: 'Quizzes', weight: 20 },
      { id: 'exam', name: 'Exam', weight: 80 }
    ], [
      { category_id: 'quiz', input_method: 'percent', percentage: 80, weight: 40, is_completed: true },
      { category_id: 'quiz', input_method: 'percent', percentage: null, weight: 60, is_completed: false }
    ])
    const prediction = predictFinal(categoryResult, { quiz: 100 })
    expect(prediction.projectedFinal).toBeCloseTo(18.4)
    expect(prediction.projectedWeight).toBeCloseTo(12)
  })

  it('projects individual what-if scores using the service-calculated assessment weights', () => {
    const vector = computeSubjectGrade({ weighting_mode: 'individual' }, [], [
      { id: 'done', input_method: 'percent', percentage: 90, weight: 60, is_completed: true },
      { id: 'final', input_method: 'percent', percentage: null, weight: 40, is_completed: false }
    ])
    const prediction = predictFinal(vector, { final: 95 })
    expect(prediction.projectedFinal).toBeCloseTo(92)
    expect(prediction.projectedAverage).toBeCloseTo(92)
  })

  it('projects category what-if scores without double-counting relative weights', () => {
    const vector = computeSubjectGrade({ weighting_mode: 'category' }, [
      { id: 'quiz', weight: 20 },
      { id: 'exam', weight: 80 }
    ], [
      { id: 'quiz-done', category_id: 'quiz', input_method: 'percent', percentage: 80, weight: 40, is_completed: true },
      { id: 'quiz-next', category_id: 'quiz', input_method: 'percent', percentage: null, weight: 60, is_completed: false },
      { id: 'exam-final', category_id: 'exam', input_method: 'percent', percentage: null, weight: 100, is_completed: false }
    ])
    const prediction = predictFinal(vector, { 'quiz-next': 100, 'exam-final': 90 })
    expect(prediction.projectedFinal).toBeCloseTo(90.4)
    expect(prediction.projectedWeight).toBeCloseTo(92)
  })

  it('treats missing or invalid hypothetical scores as zero contribution', () => {
    expect(predictFinal(result, 120).projectedFinal).toBeCloseTo(32)
    expect(predictFinal(result, null).projectedWeight).toBe(0)
  })
})

describe('requiredScoreForTarget', () => {
  it('calculates the reference required average', () => {
    const result = requiredScoreForTarget({
      earned: 52,
      completedWeight: 60,
      remainingWeight: 40,
      totalConfiguredWeight: 100
    }, 90)
    expect(result).toEqual({
      status: 'achievable',
      requiredPercent: 95,
      message: 'Target is achievable with the required remaining average.'
    })
  })

  it.each([
    [101, 'invalid_target'],
    [NaN, 'invalid_target']
  ])('rejects invalid target %s', (target, status) => {
    expect(requiredScoreForTarget({
      earned: 0, completedWeight: 0, remainingWeight: 100, totalConfiguredWeight: 100
    }, target).status).toBe(status)
  })

  it('reports an already achieved target', () => {
    expect(requiredScoreForTarget({
      earned: 91, completedWeight: 70, remainingWeight: 30, totalConfiguredWeight: 100
    }, 90)).toMatchObject({ status: 'achieved', requiredPercent: 0 })
  })

  it('reports an impossible target above 100 percent required', () => {
    const result = requiredScoreForTarget({
      earned: 20, completedWeight: 60, remainingWeight: 40, totalConfiguredWeight: 100
    }, 100)
    expect(result.status).toBe('impossible')
    expect(result.requiredPercent).toBe(200)
  })

  it('reports no remaining weight and missing configuration separately', () => {
    expect(requiredScoreForTarget({
      earned: 70, completedWeight: 100, remainingWeight: 0, totalConfiguredWeight: 100
    }, 90).status).toBe('no_remaining')
    expect(requiredScoreForTarget({
      earned: 20, completedWeight: 20, remainingWeight: 60, totalConfiguredWeight: 80
    }, 90).status).toBe('weights_missing')
  })

  it('retains the legacy predictor behavior for the existing page', () => {
    expect(predictGrade({ target: 90, earned: 52, remainingWeight: 40, hypotheticalPercent: 100 }))
      .toMatchObject({ status: 'possible', requiredAverage: 95, projectedFinal: 92 })
    expect(predictGrade({ target: 100, earned: 20, remainingWeight: 40 }).status).toBe('impossible')
  })
})
