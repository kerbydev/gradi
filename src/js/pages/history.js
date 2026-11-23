import { loadAcademicRecords } from '../api/academicRecordsApi.js'
import { metricCard } from '../components/statCard.js'
import { computeCumulativeGwa, computeGwa } from '../services/gwaCalculator.js'
import { sumSubjectUnits } from '../utils/academic.js'
import { dataErrorMessage } from '../utils/apiError.js'
import { h } from '../utils/dom.js'
import { formatFinalGrade, formatGwa, formatUnits } from '../utils/format.js'

function subjectList(subjects) {
  if (!subjects.length) {
    return h('p', { className: 'text-muted', text: 'No subjects in this semester.' })
  }
  const list = h('ul', { className: 'history-subject-list' })
  list.appendChild(h('li', { className: 'history-subject-list__header' }, [
    h('span', { text: 'Subject' }),
    h('span', { text: 'Units' }),
    h('span', { text: 'Final grade' }),
    h('span', { text: 'Source' })
  ]))
  for (const subject of subjects) {
    list.appendChild(h('li', {}, [
      h('span', { className: 'history-subject-list__name' }, [
        h('strong', { text: subject.code }),
        h('span', { text: subject.name })
      ]),
      h('span', { className: 'history-subject-fact', dataLabel: 'Units', text: formatUnits(Number(subject.units)) }),
      h('span', { className: 'history-subject-fact', dataLabel: 'Final grade', text: formatFinalGrade(subject.final_grade) }),
      h('span', { className: 'history-subject-fact text-muted', dataLabel: 'Source', text: subject.final_grade?.source === 'computed' ? 'Computed' : subject.final_grade ? 'Manual' : 'Not recorded' })
    ]))
  }
  return list
}

function semesterCard(record, decimals) {
  const { semester, subjects } = record
  const result = computeGwa(subjects)
  const card = h('article', { className: 'card history-semester' })
  card.append(
    h('div', { className: 'history-semester__heading' }, [
      h('div', {}, [
        h('h3', { text: semester.term }),
        h('p', { className: 'text-muted', text: `${semester.start_date || ''}${semester.end_date ? ` – ${semester.end_date}` : ''}`.trim() })
      ]),
      h('span', { className: 'badge', text: semester.status === 'active' ? 'Active' : 'Archived' })
    ]),
    h('div', { className: 'history-semester__stats' }, [
      h('span', {}, [h('strong', { text: 'Semester GWA' }), h('span', { text: formatGwa(result.gwa, decimals) })]),
      h('span', {}, [h('strong', { text: 'Total units' }), h('span', { text: formatUnits(sumSubjectUnits(subjects)) })]),
      h('span', {}, [h('strong', { text: 'Counted units' }), h('span', { text: formatUnits(result.totalUnitsCounted) })])
    ]),
    subjectList(subjects)
  )
  return card
}

function comparisonCard(record, decimals) {
  if (!record) {
    return h('article', { className: 'card history-comparison-card history-comparison-card--empty' }, [
      h('h3', { text: 'Choose a semester' }),
      h('p', { className: 'text-muted', text: 'Select two semesters to compare their subjects and GWA.' })
    ])
  }
  const { semester, subjects } = record
  const result = computeGwa(subjects)
  return h('article', { className: 'card history-comparison-card' }, [
    h('h3', { text: `${semester.academic_year} · ${semester.term}` }),
    h('div', { className: 'history-comparison-card__stats' }, [
      h('span', {}, [h('strong', { text: 'Semester GWA' }), h('span', { text: formatGwa(result.gwa, decimals) })]),
      h('span', {}, [h('strong', { text: 'Counted units' }), h('span', { text: formatUnits(result.totalUnitsCounted) })]),
      h('span', {}, [h('strong', { text: 'Total units' }), h('span', { text: formatUnits(sumSubjectUnits(subjects)) })])
    ]),
    subjectList(subjects)
  ])
}

export async function render(container) {
  const heading = h('div', { className: 'page-heading' }, [
    h('div', {}, [
      h('p', { className: 'eyebrow', text: 'Academic performance' }),
      h('h1', { text: 'History' }),
      h('p', { className: 'text-muted', text: 'Review semester grades and compare terms. Cumulative GWA is calculated from subject rows, not semester averages.' })
    ])
  ])
  container.replaceChildren(heading, h('div', { className: 'skeleton', ariaLabel: 'Loading semester history' }))

  let records
  try {
    records = await loadAcademicRecords()
  } catch (error) {
    container.replaceChildren(heading, h('div', { className: 'empty-state' }, [
      h('strong', { text: 'Could not load semester history' }),
      h('p', { text: dataErrorMessage(error, 'Try again in a moment.') })
    ]))
    return
  }

  const decimals = Number.isInteger(Number(records.profile?.gwa_decimals))
    ? Number(records.profile.gwa_decimals)
    : 2
  const cumulative = computeCumulativeGwa(records.subjects)
  const summary = h('div', { className: 'stats-grid history-summary' }, [
    metricCard('Cumulative GWA', formatGwa(cumulative.gwa, decimals)),
    metricCard('Units counted', formatUnits(cumulative.totalUnitsCounted)),
    metricCard('Units not counted', formatUnits(cumulative.totalUnitsUncounted), `${cumulative.uncounted.length} subject(s)`),
    metricCard('Total units', formatUnits(sumSubjectUnits(records.subjects)))
  ])

  const comparison = h('section', { className: 'history-comparison' })
  const comparisonHeading = h('div', { className: 'section-heading' }, [
    h('div', {}, [
      h('h2', { text: 'Compare semesters' }),
      h('p', { className: 'text-muted', text: 'Compare each term side by side, including subject-level grades and units.' })
    ])
  ])
  const selectors = h('div', { className: 'history-comparison__selectors' })
  const leftSelect = h('select', { ariaLabel: 'First semester to compare' })
  const rightSelect = h('select', { ariaLabel: 'Second semester to compare' })
  for (const semester of records.semesters) {
    const label = `${semester.academic_year} · ${semester.term}`
    leftSelect.appendChild(h('option', { value: semester.id, text: label }))
    rightSelect.appendChild(h('option', { value: semester.id, text: label }))
  }
  leftSelect.value = records.semesters[0]?.id ?? ''
  rightSelect.value = records.semesters[1]?.id ?? ''
  if (records.semesters.length < 2) {
    rightSelect.replaceChildren(h('option', { value: '', text: 'Choose another semester' }))
  }
  selectors.append(
    h('label', {}, [h('span', { text: 'First semester' }), leftSelect]),
    h('label', {}, [h('span', { text: 'Second semester' }), rightSelect])
  )
  const comparisonCards = h('div', { className: 'history-comparison__cards' })
  comparison.append(comparisonHeading, selectors, comparisonCards)

  function drawComparison() {
    const left = records.semesterRecords.find(record => record.semester.id === leftSelect.value)
    const right = records.semesterRecords.find(record => record.semester.id === rightSelect.value)
    comparisonCards.replaceChildren(comparisonCard(left, decimals), comparisonCard(right, decimals))
  }
  leftSelect.addEventListener('change', () => {
    if (leftSelect.value && leftSelect.value === rightSelect.value && records.semesters.length > 1) {
      rightSelect.value = records.semesters.find(item => item.id !== leftSelect.value)?.id ?? ''
    }
    drawComparison()
  })
  rightSelect.addEventListener('change', () => {
    if (rightSelect.value && leftSelect.value === rightSelect.value && records.semesters.length > 1) {
      leftSelect.value = records.semesters.find(item => item.id !== rightSelect.value)?.id ?? ''
    }
    drawComparison()
  })
  drawComparison()

  const historyList = h('div', { className: 'history-years' })
  if (!records.semesterRecords.length) {
    historyList.appendChild(h('div', { className: 'empty-state' }, [
      h('strong', { text: 'No semester history yet' }),
      h('p', { text: 'Create a semester and add subjects to see your academic history.' })
    ]))
  } else {
    const byYear = new Map()
    for (const record of records.semesterRecords) {
      const year = record.semester.academic_year || 'Academic year not set'
      if (!byYear.has(year)) byYear.set(year, [])
      byYear.get(year).push(record)
    }
    for (const [year, yearRecords] of byYear) {
      historyList.appendChild(h('section', { className: 'history-year' }, [
        h('h2', { text: year }),
        h('div', { className: 'history-semesters' }, yearRecords.map(record => semesterCard(record, decimals)))
      ]))
    }
  }

  container.replaceChildren(heading, summary, comparison, historyList)
}
