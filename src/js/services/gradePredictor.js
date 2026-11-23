import { predictFinal, requiredScoreForTarget } from './gradeCalculator.js'

/** @see {@link predictFinal} */
export { predictFinal }

/** @see {@link requiredScoreForTarget} */
export { requiredScoreForTarget }

/**
 * Legacy compatibility predictor for the original calculator page.
 *
 * @param {{target:number,earned:number,remainingWeight:number,hypotheticalPercent?:number}} values Predictor inputs.
 * @returns {object} Legacy result fields including requiredAverage.
 * @deprecated Use requiredScoreForTarget and predictFinal.
 */
export function predictGrade({ target, earned, remainingWeight, hypotheticalPercent }) {
  const result = requiredScoreForTarget({
    earned,
    completedWeight: 100 - remainingWeight,
    remainingWeight,
    totalConfiguredWeight: 100
  }, target)
  const requiredAverage = result.requiredPercent
  const projectedFinal = Number.isFinite(hypotheticalPercent)
    ? earned + hypotheticalPercent * remainingWeight / 100
    : undefined
  const legacyStatus = result.status === 'achievable' ? 'possible' : result.status
  return {
    status: legacyStatus,
    requiredAverage,
    ...(projectedFinal === undefined ? {} : { projectedFinal }),
    message: result.message
  }
}
