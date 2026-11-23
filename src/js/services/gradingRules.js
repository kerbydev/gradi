export const VALID_GRADES = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 4, 5]
const RULE_TOLERANCE = 0.0001
const CENT = 0.01

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function formatPercent(value) {
  return `${Number(value).toFixed(2)}%`
}

/**
 * Finds invalid ranges, overlaps, and uncovered percentage intervals.
 *
 * A range that overlaps another is invalid. Gaps are returned separately so
 * callers can warn while still allowing intentionally partial rule sets.
 *
 * @param {Array<object>} rules Grading rules with min_percent, max_percent, and grade.
 * @returns {{errors:string[],overlaps:string[],gaps:string[]}}
 */
export function inspectGradingRules(rules = []) {
  const errors = []
  const overlaps = []
  const gaps = []
  const validRules = []

  for (const [index, rule] of (Array.isArray(rules) ? rules : []).entries()) {
    const min = numberOrNull(rule?.min_percent)
    const max = numberOrNull(rule?.max_percent)
    const grade = numberOrNull(rule?.grade)
    if (min === null || max === null || min < 0 || max > 100 || min > max) {
      errors.push(`Rule ${index + 1} must have a valid range from 0% to 100%.`)
      continue
    }
    if (grade === null || !VALID_GRADES.includes(grade)) {
      errors.push(`Rule ${index + 1} has an invalid numeric grade.`)
      continue
    }
    validRules.push({ min, max })
  }

  validRules.sort((left, right) => left.min - right.min || left.max - right.max)
  if (!validRules.length) {
    gaps.push(`${formatPercent(0)}–${formatPercent(100)}`)
    return { errors, overlaps, gaps }
  }

  if (validRules[0].min > RULE_TOLERANCE) {
    gaps.push(`${formatPercent(0)}–${formatPercent(validRules[0].min - CENT)}`)
  }
  for (let index = 1; index < validRules.length; index += 1) {
    const previous = validRules[index - 1]
    const current = validRules[index]
    if (current.min <= previous.max + RULE_TOLERANCE) {
      overlaps.push(`${formatPercent(current.min)} overlaps the preceding rule ending at ${formatPercent(previous.max)}.`)
    } else if (current.min > previous.max + CENT + RULE_TOLERANCE) {
      gaps.push(`${formatPercent(previous.max + CENT)}–${formatPercent(current.min - CENT)}`)
    }
  }
  const last = validRules[validRules.length - 1]
  if (last.max < 100 - RULE_TOLERANCE) {
    gaps.push(`${formatPercent(last.max + CENT)}–${formatPercent(100)}`)
  }

  return { errors, overlaps, gaps }
}

export function validateNumericGrade(value) {
  const grade = numberOrNull(value)
  return grade !== null && VALID_GRADES.includes(grade)
    ? ''
    : 'Choose a valid numeric grade from 1.00 to 5.00.'
}
