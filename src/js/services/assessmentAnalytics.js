function localDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Splits assessments into completed, overdue, and upcoming buckets.
 *
 * Upcoming includes due dates from today through `daysAhead`, inclusive.
 *
 * @param {Array<object>} assessments Assessment rows with due_date and is_completed.
 * @param {Date} now Current local date/time.
 * @param {number} daysAhead Number of days to include in the upcoming window.
 * @returns {{total:number,completed:Array<object>,overdue:Array<object>,upcoming:Array<object>}}
 */
export function classifyAssessments(assessments = [], now = new Date(), daysAhead = 14) {
  if (!Array.isArray(assessments)) throw new TypeError('Assessments must be an array.')
  const rows = assessments
  const today = localDateKey(now)
  const lastUpcomingDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysAhead)
  const endDate = localDateKey(lastUpcomingDate)
  const completed = rows.filter(assessment => assessment?.is_completed === true)
  const overdue = []
  const upcoming = []

  for (const assessment of rows) {
    if (!assessment || assessment.is_completed === true || !assessment.due_date) continue
    const dueDate = String(assessment.due_date).slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) continue
    if (dueDate < today) overdue.push(assessment)
    else if (dueDate <= endDate) upcoming.push(assessment)
  }

  overdue.sort((left, right) => String(left.due_date).localeCompare(String(right.due_date)))
  upcoming.sort((left, right) => String(left.due_date).localeCompare(String(right.due_date)))
  return { total: rows.length, completed, overdue, upcoming }
}
