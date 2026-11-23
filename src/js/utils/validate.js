export function validateScore(score, totalPoints) {
  if (!Number.isFinite(score) || score < 0) return 'Score cannot be negative.'
  if (!Number.isFinite(totalPoints) || totalPoints <= 0) return 'Total points must be greater than 0.'
  if (score > totalPoints) return 'Score cannot be greater than total points.'
  return ''
}

export function validateAssessmentValues(values) {
  if (!String(values?.name ?? '').trim()) return 'Assessment name is required.'
  if (!values.category_id) return 'Choose a category.'
  if (!['raw', 'percent'].includes(values.input_method)) return 'Choose a valid input method.'
  if (!Number.isFinite(values.weight) || values.weight < 0 || values.weight > 100) {
    return 'Weight must be between 0 and 100.'
  }

  const hasScore = values.score !== null && values.score !== undefined
  const hasTotal = values.total_points !== null && values.total_points !== undefined
  const hasPercentage = values.percentage !== null && values.percentage !== undefined

  if (values.input_method === 'raw') {
    if (hasPercentage) return 'Raw-score assessments cannot include a percentage.'
    if (hasScore !== hasTotal) return 'Enter both the score and total points, or leave both blank.'
    if (hasScore) {
      const scoreError = validateScore(values.score, values.total_points)
      if (scoreError) return scoreError
    }
    if (values.is_completed && !hasScore) return 'Enter a score before marking this assessment complete.'
  } else {
    if (hasScore || hasTotal) return 'Percentage assessments cannot include raw score values.'
    if (hasPercentage) {
      const percentageError = validatePercentage(values.percentage)
      if (percentageError) return percentageError
    }
    if (values.is_completed && !hasPercentage) return 'Enter a percentage before marking this assessment complete.'
  }
  return ''
}

export function validatePercentage(value) {
  return Number.isFinite(value) && value >= 0 && value <= 100 ? '' : 'Percentage must be between 0 and 100.'
}

export function validateWeight(value) {
  return Number.isFinite(value) && value >= 0 && value <= 100 ? '' : 'Weight must be between 0 and 100.'
}

export function validateUnits(value) {
  return Number.isFinite(value) && value > 0 && value <= 12 ? '' : 'Units must be greater than 0 and at most 12.'
}

export function validateAcademicYear(value) {
  const match = /^(\d{4})-(\d{4})$/.exec(value.trim())
  if (!match) return 'Use the format YYYY-YYYY.'
  if (Number(match[2]) !== Number(match[1]) + 1) return 'The second year must be one year after the first.'
  return ''
}

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim()) ? '' : 'Enter a valid email address.'
}

export function validateRequired(value, label = 'This field') {
  return String(value ?? '').trim() ? '' : `${label} is required.`
}

export function validateGrade(value) {
  return Number.isFinite(value) && value >= 1.0 && value <= 5.0 ? '' : 'Grade must be between 1.0 and 5.0.'
}

export function validateName(value) {
  const name = String(value ?? '').trim()
  return name.length >= 2 ? '' : 'Name must contain at least 2 characters.'
}

export function validatePassword(value) {
  return String(value ?? '').length >= 8 ? '' : 'Password must be at least 8 characters.'
}
