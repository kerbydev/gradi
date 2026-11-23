const WEIGHT_TOLERANCE = 0.0001

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function weightOf(value) {
  const weight = finiteNumber(value)
  return weight !== null && weight >= 0 ? weight : null
}

function weightTotalWarning(total) {
  return Math.abs(total - 100) <= WEIGHT_TOLERANCE
    ? []
    : [`Configured weights total ${total}%; expected 100%.`]
}

function isComplete(assessment, percentage) {
  return assessment?.is_completed !== false && percentage !== null
}

function assessmentLabel(assessment, fallback) {
  return assessment?.name ? `"${assessment.name}"` : fallback
}

/**
 * Converts a raw score or a percentage assessment to a validated percentage.
 *
 * Percentage input must be in [0, 100]. Raw input requires a non-negative
 * score, positive total points, and score no greater than total points.
 *
 * @param {object} assessment Assessment record with input_method and score fields.
 * @returns {number|null} Percentage score, or null when the input is invalid.
 */
export function computeAssessmentPercentage(assessment) {
  if (!assessment || typeof assessment !== 'object') return null

  if (assessment.input_method === 'percent') {
    const percentage = finiteNumber(assessment.percentage)
    return percentage !== null && percentage >= 0 && percentage <= 100 ? percentage : null
  }

  const score = finiteNumber(assessment.score)
  const total = finiteNumber(assessment.total_points)
  if (score === null || total === null || score < 0 || total <= 0 || score > total) return null
  return (score / total) * 100
}

/**
 * Calculates subject progress using either assessment-level or category weights.
 *
 * In individual mode each assessment weight contributes directly to the
 * subject total. In category mode category weights are split across all
 * assessments in each category by their relative assessment weights, so
 * assessment weights are never counted a second time.
 *
 * @param {object} subject Subject record; weighting_mode is 'individual' or 'category'.
 * @param {Array<object>} categories Configured category records.
 * @param {Array<object>} assessments Assessment records for this subject.
 * @returns {{earned:number, completedWeight:number, remainingWeight:number, totalConfiguredWeight:number, currentAverage:number|null, weightWarnings:string[], perCategory:Array<object>, perAssessment:Array<object>}}
 */
export function computeSubjectGrade(subject, categories = [], assessments = []) {
  const categoryRows = Array.isArray(categories) ? categories : []
  const assessmentRows = Array.isArray(assessments) ? assessments : []
  const weightWarnings = []
  let earned = 0
  let completedWeight = 0
  let totalConfiguredWeight = 0
  const perCategory = []
  const perAssessment = []

  if (subject?.weighting_mode === 'category') {
    const knownCategories = new Set(categoryRows.map(category => category?.id).filter(id => id != null))
    for (const assessment of assessmentRows) {
      if (!knownCategories.has(assessment?.category_id)) {
        weightWarnings.push(`${assessmentLabel(assessment, 'Assessment')} has no matching category and was excluded.`)
      }
    }

    for (const category of categoryRows) {
      const label = category?.name || 'Unnamed category'
      const configuredWeight = weightOf(category?.weight)
      if (configuredWeight === null) {
        weightWarnings.push(`${label} has an invalid category weight.`)
        continue
      }
      totalConfiguredWeight += configuredWeight

      const members = assessmentRows.filter(assessment => assessment?.category_id === category?.id)
      const relativeWeights = members.map(assessment => weightOf(assessment?.weight))
      for (let index = 0; index < members.length; index += 1) {
        if (relativeWeights[index] === null) {
          weightWarnings.push(`${assessmentLabel(members[index], 'Assessment')} has an invalid relative weight.`)
        }
      }

      let relativeTotal = relativeWeights.reduce((sum, weight) => sum + (weight ?? 0), 0)
      const equalWeights = members.length > 0 && relativeTotal === 0
      if (equalWeights) relativeTotal = members.length

      let categoryEarned = 0
      let categoryCompletedWeight = 0
      for (let index = 0; index < members.length; index += 1) {
        const assessment = members[index]
        const percentage = computeAssessmentPercentage(assessment)
        const relativeWeight = equalWeights ? 1 : (relativeWeights[index] ?? 0)
        const subjectWeight = relativeTotal > 0 ? configuredWeight * relativeWeight / relativeTotal : 0
        const complete = isComplete(assessment, percentage)

        if (complete) {
          const points = percentage * subjectWeight / 100
          earned += points
          completedWeight += subjectWeight
          categoryEarned += points
          categoryCompletedWeight += subjectWeight
        } else if (assessment?.is_completed === true) {
          weightWarnings.push(`${assessmentLabel(assessment, 'Assessment')} is marked complete but has no valid score.`)
        }
        perAssessment.push({
          assessmentId: assessment?.id ?? null,
          categoryId: assessment?.category_id ?? category?.id ?? null,
          name: assessment?.name ?? 'Assessment',
          configuredWeight: relativeWeights[index],
          subjectWeight,
          completedWeight: complete ? subjectWeight : 0,
          remainingWeight: complete ? 0 : subjectWeight
        })
      }

      perCategory.push({
        categoryId: category?.id ?? null,
        name: label,
        configuredWeight,
        earned: categoryEarned,
        completedWeight: categoryCompletedWeight,
        remainingWeight: configuredWeight - categoryCompletedWeight,
        currentAverage: categoryCompletedWeight > 0 ? categoryEarned / categoryCompletedWeight * 100 : null
      })
    }
  } else {
    for (const assessment of assessmentRows) {
      const weight = weightOf(assessment?.weight)
      if (weight === null) {
        weightWarnings.push(`${assessmentLabel(assessment, 'Assessment')} has an invalid weight.`)
        if (assessment?.is_completed === true && computeAssessmentPercentage(assessment) === null) {
          weightWarnings.push(`${assessmentLabel(assessment, 'Assessment')} is marked complete but has no valid score.`)
        }
        perAssessment.push({
          assessmentId: assessment?.id ?? null,
          categoryId: assessment?.category_id ?? null,
          name: assessment?.name ?? 'Assessment',
          configuredWeight: null,
          subjectWeight: 0,
          completedWeight: 0,
          remainingWeight: 0
        })
        continue
      }
      totalConfiguredWeight += weight
      const percentage = computeAssessmentPercentage(assessment)
      const complete = isComplete(assessment, percentage)
      if (complete) {
        earned += percentage * weight / 100
        completedWeight += weight
      } else if (assessment?.is_completed === true) {
        weightWarnings.push(`${assessmentLabel(assessment, 'Assessment')} is marked complete but has no valid score.`)
      }
      perAssessment.push({
        assessmentId: assessment?.id ?? null,
        categoryId: assessment?.category_id ?? null,
        name: assessment?.name ?? 'Assessment',
        configuredWeight: weight,
        subjectWeight: weight,
        completedWeight: complete ? weight : 0,
        remainingWeight: complete ? 0 : weight
      })
    }
  }

  weightWarnings.push(...weightTotalWarning(totalConfiguredWeight))
  return {
    earned,
    completedWeight,
    remainingWeight: Math.max(0, totalConfiguredWeight - completedWeight),
    totalConfiguredWeight,
    currentAverage: completedWeight > 0 ? earned / completedWeight * 100 : null,
    weightWarnings,
    perCategory,
    perAssessment
  }
}

/**
 * Projects a final percentage from a subject result and hypothetical scores.
 *
 * A single number applies to all remaining weight. An array of numbers is
 * averaged and applied to all remaining weight; arrays of {percent, weight}
 * allocate their supplied weights (an omitted weight receives an equal share).
 * An object may provide averagePercent, percent, assessmentId-to-percent, or
 * categoryId-to-percent values.
 *
 * @param {object} subjectResult Result from computeSubjectGrade.
 * @param {number|Array<number|{percent:number,weight?:number}>|object} hypotheticalScores Hypothetical percentages.
 * @returns {{projectedFinal:number, projectedAverage:number|null, hypotheticalEarned:number, projectedWeight:number, remainingWeight:number}}
 */
export function predictFinal(subjectResult, hypotheticalScores) {
  const earned = finiteNumber(subjectResult?.earned) ?? 0
  const remainingWeight = Math.max(0, finiteNumber(subjectResult?.remainingWeight) ?? 0)
  let hypotheticalEarned = 0
  let projectedWeight = 0

  const applyScore = (scoreValue, weightValue) => {
    const score = finiteNumber(scoreValue)
    const weight = weightOf(weightValue)
    if (score === null || score < 0 || score > 100 || weight === null) return
    hypotheticalEarned += score * weight / 100
    projectedWeight += weight
  }

  if (typeof hypotheticalScores === 'number') {
    applyScore(hypotheticalScores, remainingWeight)
  } else if (Array.isArray(hypotheticalScores)) {
    if (hypotheticalScores.some(item => item && typeof item === 'object')) {
      const defaultWeight = hypotheticalScores.length ? remainingWeight / hypotheticalScores.length : 0
      for (const item of hypotheticalScores) {
        if (item && typeof item === 'object') applyScore(item.percent ?? item.score, item.weight ?? defaultWeight)
        else applyScore(item, defaultWeight)
      }
    } else {
      const scores = hypotheticalScores.map(finiteNumber).filter(score => score !== null && score >= 0 && score <= 100)
      if (scores.length) applyScore(scores.reduce((sum, score) => sum + score, 0) / scores.length, remainingWeight)
    }
  } else if (hypotheticalScores && typeof hypotheticalScores === 'object') {
    const average = finiteNumber(hypotheticalScores.averagePercent ?? hypotheticalScores.percent)
    if (average !== null) {
      applyScore(average, remainingWeight)
    } else {
      const categories = Array.isArray(subjectResult?.perCategory) ? subjectResult.perCategory : []
      const assessments = Array.isArray(subjectResult?.perAssessment) ? subjectResult.perAssessment : []
      const categoriesWithAssessmentScores = new Set()
      for (const assessment of assessments) {
        const id = assessment?.assessmentId
        if (id == null || !Object.prototype.hasOwnProperty.call(hypotheticalScores, id)) continue
        applyScore(hypotheticalScores[id], assessment.remainingWeight)
        if (assessment.categoryId != null) categoriesWithAssessmentScores.add(assessment.categoryId)
      }
      for (const category of categories) {
        if (
          category?.categoryId != null
          && !categoriesWithAssessmentScores.has(category.categoryId)
          && Object.prototype.hasOwnProperty.call(hypotheticalScores, category.categoryId)
        ) {
          applyScore(hypotheticalScores[category.categoryId], category.remainingWeight)
        }
      }
    }
  }

  const projectedFinal = earned + hypotheticalEarned
  const projectedWeightTotal = (finiteNumber(subjectResult?.completedWeight) ?? 0) + projectedWeight
  return {
    projectedFinal,
    projectedAverage: projectedWeightTotal > 0 ? projectedFinal / projectedWeightTotal * 100 : null,
    hypotheticalEarned,
    projectedWeight,
    remainingWeight
  }
}

function isFullWeight(total) {
  return Math.abs(total - 100) <= WEIGHT_TOLERANCE
}

/**
 * Computes the average percentage required across remaining configured weight.
 *
 * @param {object} subjectResult Result from computeSubjectGrade.
 * @param {number} target Desired final percentage from 0 to 100.
 * @returns {{status:'achieved'|'achievable'|'impossible'|'no_remaining'|'invalid_target'|'weights_missing',requiredPercent:number|null,message:string}}
 */
export function requiredScoreForTarget(subjectResult, target) {
  const desired = finiteNumber(target)
  if (desired === null || desired < 0 || desired > 100) {
    return { status: 'invalid_target', requiredPercent: null, message: 'Target must be between 0 and 100.' }
  }

  const earned = finiteNumber(subjectResult?.earned)
  const remainingWeight = finiteNumber(subjectResult?.remainingWeight)
  const totalConfiguredWeight = finiteNumber(subjectResult?.totalConfiguredWeight)
  if (earned === null || remainingWeight === null || totalConfiguredWeight === null || !isFullWeight(totalConfiguredWeight)) {
    return { status: 'weights_missing', requiredPercent: null, message: 'Configured weights must total 100% before predicting a target.' }
  }

  if (earned >= desired) {
    return { status: 'achieved', requiredPercent: 0, message: 'Target already achieved.' }
  }
  if (remainingWeight <= WEIGHT_TOLERANCE) {
    return { status: 'no_remaining', requiredPercent: null, message: 'There is no remaining weight.' }
  }

  const requiredPercent = (desired - earned) / (remainingWeight / 100)
  if (requiredPercent > 100 + WEIGHT_TOLERANCE) {
    return { status: 'impossible', requiredPercent, message: 'The target is impossible with the remaining weight.' }
  }
  return {
    status: 'achievable',
    requiredPercent: Math.min(100, requiredPercent),
    message: 'Target is achievable with the required remaining average.'
  }
}

/**
 * Maps a percentage into the first matching grading rule interval.
 *
 * Bounds are inclusive; rules are considered in the order provided.
 *
 * @param {number} percent Percentage from 0 to 100.
 * @param {Array<object>} rules Rules with min_percent, max_percent, and grade.
 * @returns {{grade:number|null,matchedRule:object|null}}
 */
export function convertPercentToGrade(percent, rules = []) {
  const value = finiteNumber(percent)
  if (value === null || value < 0 || value > 100 || !Array.isArray(rules)) {
    return { grade: null, matchedRule: null }
  }

  for (const rule of rules) {
    const minimum = finiteNumber(rule?.min_percent)
    const maximum = finiteNumber(rule?.max_percent)
    const grade = finiteNumber(rule?.grade)
    if (minimum === null || maximum === null || grade === null
      || minimum < 0 || maximum > 100 || minimum > maximum) continue
    if (value >= minimum && value <= maximum) return { grade, matchedRule: rule }
  }
  return { grade: null, matchedRule: null }
}

/**
 * Legacy compatibility wrapper for individual-weight calculations.
 *
 * @param {Array<object>} assessments Individual assessments.
 * @returns {object} Subject calculation result with legacy weight fields.
 * @deprecated Use computeSubjectGrade.
 */
export function calculateIndividual(assessments) {
  const result = computeSubjectGrade({ weighting_mode: 'individual' }, [], assessments)
  return { ...result, weightsTotal: result.totalConfiguredWeight, weightsValid: isFullWeight(result.totalConfiguredWeight) }
}

/**
 * Legacy compatibility wrapper for category-weight calculations.
 *
 * @param {Array<object>} assessments Category assessment records.
 * @param {Array<object>} categories Category records.
 * @returns {object} Subject calculation result with legacy weight fields.
 * @deprecated Use computeSubjectGrade.
 */
export function calculateCategory(assessments, categories) {
  const result = computeSubjectGrade({ weighting_mode: 'category' }, categories, assessments)
  return { ...result, weightsTotal: result.totalConfiguredWeight, weightsValid: isFullWeight(result.totalConfiguredWeight) }
}

/** @deprecated Use computeAssessmentPercentage. */
export const assessmentPercentage = computeAssessmentPercentage
