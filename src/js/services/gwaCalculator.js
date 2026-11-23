function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function subjectIdentity(subject, index) {
  return {
    subjectId: subject?.id ?? null,
    name: subject?.name ?? subject?.code ?? `Subject ${index + 1}`
  }
}

/**
 * Calculates the unit-weighted GWA and lists subjects excluded from the result.
 *
 * Rows with counts_in_gwa=false, a non-final status, invalid grade, or invalid
 * units are excluded. Only grades in the 1.00–5.00 range with positive units
 * contribute to the weighted mean.
 *
 * @param {Array<object>} subjectsWithGrades Subject rows with units and final_grade.
 * @returns {{gwa:number|null,totalUnitsCounted:number,totalUnitsUncounted:number,uncounted:Array<object>}}
 */
export function computeGwa(subjectsWithGrades = []) {
  let weightedGradeTotal = 0
  let totalUnitsCounted = 0
  let totalUnitsUncounted = 0
  const uncounted = []

  for (const [index, subject] of (Array.isArray(subjectsWithGrades) ? subjectsWithGrades : []).entries()) {
    const units = finiteNumber(subject?.units)
    const grade = finiteNumber(subject?.final_grade?.grade_value ?? subject?.grade_value)
    const status = subject?.final_grade?.status ?? subject?.status ?? null
    let reason = null

    if (subject?.counts_in_gwa === false) reason = 'excluded_by_setting'
    else if (units === null || units <= 0) reason = 'invalid_units'
    else if (status) reason = 'status'
    else if (grade === null || grade < 1 || grade > 5) reason = 'missing_or_invalid_grade'

    if (reason) {
      const uncountedUnits = units !== null && units > 0 ? units : 0
      totalUnitsUncounted += uncountedUnits
      uncounted.push({
        ...subjectIdentity(subject, index),
        units: uncountedUnits,
        status,
        reason
      })
      continue
    }

    weightedGradeTotal += grade * units
    totalUnitsCounted += units
  }

  return {
    gwa: totalUnitsCounted > 0 ? weightedGradeTotal / totalUnitsCounted : null,
    totalUnitsCounted,
    totalUnitsUncounted,
    uncounted
  }
}

/**
 * Calculates cumulative GWA across a flat collection of subject rows.
 *
 * @param {Array<object>} allSubjectsWithGrades Subject rows from any number of semesters.
 * @returns {{gwa:number|null,totalUnitsCounted:number,totalUnitsUncounted:number,uncounted:Array<object>}}
 */
export function computeCumulativeGwa(allSubjectsWithGrades = []) {
  return computeGwa(allSubjectsWithGrades)
}

/**
 * Legacy compatibility wrapper for the original GWA page and dashboard.
 *
 * @param {Array<object>} subjectRows Subject rows with nested final_grade values.
 * @returns {object} GWA result with legacy counters.
 * @deprecated Use computeGwa.
 */
export function calculateGwa(subjectRows) {
  const result = computeGwa(subjectRows)
  return {
    ...result,
    countedUnits: result.totalUnitsCounted,
    uncountedCount: result.uncounted.length,
    uncountedUnits: result.totalUnitsUncounted
  }
}
