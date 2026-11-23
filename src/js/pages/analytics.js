import { loadAcademicRecords } from '../api/academicRecordsApi.js'
import { metricCard } from '../components/statCard.js'
import { classifyAssessments } from '../services/assessmentAnalytics.js'
import { computeSubjectGrade } from '../services/gradeCalculator.js'
import { computeCumulativeGwa, computeGwa } from '../services/gwaCalculator.js'
import { dataErrorMessage } from '../utils/apiError.js'
import { h } from '../utils/dom.js'
import { formatGwa, formatGrade, formatPercent, formatUnits } from '../utils/format.js'

function token(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

function currentAverage(subject) {
  return computeSubjectGrade(
    subject,
    subject.assessment_categories ?? [],
    subject.assessments ?? []
  ).currentAverage
}

function assessmentRows(subjects) {
  return subjects.flatMap(subject => (subject.assessments ?? []).map(assessment => ({
    ...assessment,
    subjectCode: subject.code
  })))
}

function subjectPerformanceRows(subjects) {
  return subjects.map(subject => ({
    subject,
    average: currentAverage(subject)
  })).filter(item => Number.isFinite(item.average))
}

export async function render(container) {
  const heading = h('div', { className: 'page-heading' }, [
    h('div', {}, [
      h('p', { className: 'eyebrow', text: 'Insights' }),
      h('h1', { text: 'Analytics' }),
      h('p', { className: 'text-muted', text: 'Review unit-weighted GWA trends and current subject performance.' })
    ])
  ])
  container.replaceChildren(heading, h('div', { className: 'skeleton', ariaLabel: 'Loading analytics' }))

  let records
  try {
    records = await loadAcademicRecords()
  } catch (error) {
    container.replaceChildren(heading, h('div', { className: 'empty-state' }, [
      h('strong', { text: 'Could not load analytics' }),
      h('p', { text: dataErrorMessage(error, 'Try again in a moment.') })
    ]))
    return
  }

  if (!records.semesters.length) {
    container.replaceChildren(heading, h('div', { className: 'empty-state' }, [
      h('strong', { text: 'No analytics data yet' }),
      h('p', { text: 'Create your first semester and add subjects and assessments to see performance trends.' }),
      h('a', { className: 'button button--primary', href: '#/semesters', text: 'Create your first semester' })
    ]))
    return
  }

  const decimals = Number.isInteger(Number(records.profile?.gwa_decimals))
    ? Number(records.profile.gwa_decimals)
    : 2
  const semesterRecords = [...records.semesterRecords].sort((left, right) =>
    String(left.semester.start_date).localeCompare(String(right.semester.start_date))
  )
  const semesterLabels = new Map(records.semesters.map(semester => [
    semester.id,
    `${semester.academic_year} · ${semester.term}`
  ]))
  const semesterGwas = semesterRecords.map(record => ({
    label: `${record.semester.academic_year} · ${record.semester.term}`,
    gwa: computeGwa(record.subjects).gwa
  }))
  const performanceRows = subjectPerformanceRows(records.subjects)
  const numericGradeRows = records.subjects.map(subject => ({
    subject,
    grade: Number(subject.final_grade?.grade_value)
  })).filter(({ subject, grade }) =>
    subject.final_grade?.status == null && Number.isFinite(grade) && grade >= 1 && grade <= 5
  )
  const highest = numericGradeRows.reduce((value, row) => !value || row.grade > value.grade ? row : value, null)
  const lowest = numericGradeRows.reduce((value, row) => !value || row.grade < value.grade ? row : value, null)
  const assessments = classifyAssessments(assessmentRows(records.subjects))
  const cumulative = computeCumulativeGwa(records.subjects)
  const completionRate = assessments.total
    ? formatPercent((assessments.completed.length / assessments.total) * 100, 1)
    : 'No assessments'
  const summary = h('div', { className: 'stats-grid analytics-stats' }, [
    metricCard('Highest numeric grade', highest ? formatGrade(highest.grade) : '—', highest?.subject.name ?? 'No numeric final grades'),
    metricCard('Lowest numeric grade', lowest ? formatGrade(lowest.grade) : '—', lowest?.subject.name ?? 'No numeric final grades'),
    metricCard('Completed units', formatUnits(cumulative.totalUnitsCounted)),
    metricCard('Assessment completion', `${assessments.completed.length} / ${assessments.total}`, completionRate)
  ])

  const trendCard = h('section', { className: 'card analytics-chart-card' }, [
    h('h2', { text: 'GWA trend by semester' }),
    h('p', { className: 'text-muted', text: 'Each point is calculated from that semester’s subject rows and counted units.' })
  ])
  const trendSummary = semesterGwas.map(item =>
    `${item.label}: ${item.gwa == null ? 'no counted numeric grades' : formatGwa(item.gwa, decimals)}`
  ).join(' · ')
  const trendCanvas = h('canvas', { role: 'img', ariaLabel: `GWA trend by semester. ${trendSummary}` })
  trendCard.append(
    h('div', { className: 'chart-container' }, [trendCanvas]),
    h('p', { className: 'chart-summary', text: trendSummary })
  )

  const subjectCard = h('section', { className: 'card analytics-chart-card' }, [
    h('h2', { text: 'Current subject performance' }),
    h('p', { className: 'text-muted', text: 'Current averages are computed from completed assessments using each subject’s configured weighting.' })
  ])
  let subjectCanvas = null
  if (performanceRows.length) {
    const performanceSummary = performanceRows
      .map(({ subject, average }) => `${subject.code} (${semesterLabels.get(subject.semester_id) ?? 'Semester'}): ${formatPercent(average)}`)
      .join(' · ')
    subjectCanvas = h('canvas', { role: 'img', ariaLabel: `Current subject average percentages. ${performanceSummary}` })
    subjectCard.append(
      h('div', { className: 'chart-container' }, [subjectCanvas]),
      h('p', { className: 'chart-summary', text: performanceSummary })
    )
  } else {
    subjectCard.appendChild(h('p', { className: 'text-muted', text: 'Complete an assessment to see subject performance.' }))
  }

  const charts = []
  const accent = token('--accent', '#55c99a')
  const muted = token('--text-muted', '#a8a8ad')
  const border = token('--border', '#39393e')
  container.replaceChildren(heading, summary, h('div', { className: 'analytics-charts' }, [trendCard, subjectCard]))
  let Chart
  try {
    ({ default: Chart } = await import('chart.js/auto'))
  } catch {
    trendCard.appendChild(h('p', { className: 'field-error', text: 'The chart library could not load. The text summaries remain available.' }))
    subjectCard.appendChild(h('p', { className: 'field-error', text: 'The chart library could not load. The text summaries remain available.' }))
    return () => {}
  }
  charts.push(new Chart(trendCanvas, {
    type: 'line',
    data: {
      labels: semesterGwas.map(item => item.label),
      datasets: [{
        label: 'GWA',
        data: semesterGwas.map(item => item.gwa),
        borderColor: accent,
        backgroundColor: accent,
        pointBackgroundColor: accent,
        pointRadius: 4,
        tension: 0.25,
        spanGaps: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: muted }, grid: { color: border } },
        y: { min: 1, max: 5, ticks: { color: muted }, grid: { color: border } }
      }
    }
  }))
  if (subjectCanvas) {
    charts.push(new Chart(subjectCanvas, {
      type: 'bar',
      data: {
        labels: performanceRows.map(({ subject }) => `${subject.code} · ${semesterLabels.get(subject.semester_id) ?? subject.name}`),
        datasets: [{
          label: 'Current average (%)',
          data: performanceRows.map(item => item.average),
          backgroundColor: accent,
          borderColor: accent,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: muted, maxRotation: 45, minRotation: 0 }, grid: { color: border } },
          y: { beginAtZero: true, max: 100, ticks: { color: muted }, grid: { color: border } }
        }
      }
    }))
  }
  return () => charts.forEach(chart => chart.destroy())
}
