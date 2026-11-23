import { loadAcademicRecords } from '../api/academicRecordsApi.js'
import { metricCard } from '../components/statCard.js'
import { classifyAssessments } from '../services/assessmentAnalytics.js'
import { computeSubjectGrade } from '../services/gradeCalculator.js'
import { computeGwa } from '../services/gwaCalculator.js'
import { sumSubjectUnits } from '../utils/academic.js'
import { dataErrorMessage } from '../utils/apiError.js'
import { h } from '../utils/dom.js'
import { formatDate, formatFinalGrade, formatGwa, formatPercent, formatUnits } from '../utils/format.js'

function token(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

function collectActivity(subjects, semesterLabels) {
  const events = []
  for (const subject of subjects) {
    const semesterLabel = semesterLabels.get(subject.semester_id)
    const subjectLabel = `${subject.code} · ${subject.name}${semesterLabel ? ` · ${semesterLabel}` : ''}`
    if (subject.created_at) {
      events.push({
        date: subject.created_at,
        label: 'Subject added',
        detail: subjectLabel
      })
    }
    if (subject.final_grade?.updated_at) {
      events.push({
        date: subject.final_grade.updated_at,
        label: 'Final grade updated',
        detail: `${subjectLabel} · ${subject.final_grade.status || subject.final_grade.grade_value}`
      })
    }
    for (const assessment of subject.assessments ?? []) {
      const date = assessment.updated_at || assessment.created_at
      if (!date) continue
      events.push({
        date,
        label: assessment.is_completed ? 'Assessment completed' : 'Assessment updated',
        detail: `${subjectLabel} · ${assessment.name}`
      })
    }
  }
  return events
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
    .slice(0, 6)
}

function assessmentList(bucket) {
  const items = [
    ...bucket.overdue.map(assessment => ({ assessment, overdue: true })),
    ...bucket.upcoming.map(assessment => ({ assessment, overdue: false }))
  ]
  if (!items.length) {
    return h('div', { className: 'empty-state empty-state--compact' }, [
      h('strong', { text: 'No overdue or upcoming assessments' }),
      h('p', { text: 'Assessments due in the next 14 days will appear here.' })
    ])
  }
  const list = h('ul', { className: 'dashboard-assessment-list' })
  for (const { assessment, overdue } of items) {
    list.appendChild(h('li', { className: overdue ? 'dashboard-assessment dashboard-assessment--overdue' : 'dashboard-assessment' }, [
      h('div', {}, [
        h('strong', { text: assessment.name }),
        h('span', { className: 'text-muted', text: `${assessment.subjectCode} · ${assessment.subjectName}` })
      ]),
      h('span', { className: `badge${overdue ? ' badge--danger' : ''}`, text: `${overdue ? 'Overdue' : 'Upcoming'} · ${formatDate(assessment.due_date)}` })
    ]))
  }
  return list
}

function activityList(events) {
  if (!events.length) {
    return h('div', { className: 'empty-state empty-state--compact' }, [
      h('strong', { text: 'No recent activity' }),
      h('p', { text: 'New subjects, assessments, and final grades will appear here.' })
    ])
  }
  const list = h('ul', { className: 'dashboard-activity-list' })
  for (const event of events) {
    list.appendChild(h('li', {}, [
      h('div', {}, [h('strong', { text: event.label }), h('span', { className: 'text-muted', text: event.detail })]),
      h('time', { dateTime: event.date, text: formatDate(event.date, { hour: 'numeric', minute: '2-digit' }) })
    ]))
  }
  return list
}

function quickActions() {
  return h('section', { className: 'dashboard-quick-actions' }, [
    h('h2', { text: 'Quick actions' }),
    h('div', { className: 'dashboard-quick-actions__links' }, [
      h('a', { className: 'card card--link', href: '#/semesters', text: 'Manage semesters' }),
      h('a', { className: 'card card--link', href: '#/subjects', text: 'Manage subjects' }),
      h('a', { className: 'card card--link', href: '#/assessments', text: 'Assessments' }),
      h('a', { className: 'card card--link', href: '#/gwa', text: 'Calculate GWA' })
    ])
  ])
}

export async function render(container) {
  const heading = h('div', { className: 'page-heading' }, [
    h('div', {}, [h('p', { className: 'eyebrow', text: 'Overview' }), h('h1', { text: 'Dashboard' })])
  ])
  container.replaceChildren(heading, h('div', { className: 'skeleton', ariaLabel: 'Loading dashboard' }))

  let records
  try {
    records = await loadAcademicRecords()
  } catch (error) {
    container.replaceChildren(heading, h('div', { className: 'empty-state' }, [
      h('strong', { text: 'Could not load your dashboard' }),
      h('p', { text: dataErrorMessage(error, 'Try again in a moment.') })
    ]))
    return
  }

  if (!records.semesters.length) {
    container.replaceChildren(
      heading,
      h('div', { className: 'empty-state dashboard-first-semester' }, [
        h('strong', { text: 'Create your first semester' }),
        h('p', { text: 'Add a semester to organize subjects, assessments, and grades.' }),
        h('a', { className: 'button button--primary', href: '#/semesters', text: 'Create your first semester' })
      ]),
      quickActions()
    )
    return
  }

  const activeSemester = records.semesters.find(item => item.id === records.profile?.active_semester_id)
    ?? records.semesters.find(item => item.status === 'active')
    ?? records.semesters[0]
  const subjects = records.semesterRecords.find(item => item.semester.id === activeSemester.id)?.subjects ?? []
  const semesterLabels = new Map(records.semesters.map(semester => [
    semester.id,
    `${semester.academic_year} · ${semester.term}`
  ]))
  const decimals = Number.isInteger(Number(records.profile?.gwa_decimals))
    ? Number(records.profile.gwa_decimals)
    : 2
  const gwa = computeGwa(subjects)
  const assessments = subjects.flatMap(subject =>
    (subject.assessments ?? []).map(assessment => ({
      ...assessment,
      subjectCode: subject.code,
      subjectName: subject.name
    }))
  )
  const bucket = classifyAssessments(assessments)
  const currentAverages = subjects.map(subject => ({
    subject,
    average: computeSubjectGrade(
      subject,
      subject.assessment_categories ?? [],
      subject.assessments ?? []
    ).currentAverage
  }))
  const completedAverages = currentAverages.filter(item => Number.isFinite(item.average))
  const stats = h('div', { className: 'stats-grid dashboard-stats' }, [
    metricCard('Semester GWA', formatGwa(gwa.gwa, decimals), `${activeSemester.academic_year} · ${activeSemester.term}`),
    metricCard('Total units', formatUnits(sumSubjectUnits(subjects))),
    metricCard('Subjects', String(subjects.length)),
    metricCard('Completed assessments', `${bucket.completed.length} / ${bucket.total}`),
    metricCard('Upcoming · 14 days', String(bucket.upcoming.length), `${bucket.overdue.length} overdue`)
  ])

  const overview = h('section', { className: 'card dashboard-overview' }, [
    h('div', { className: 'section-heading' }, [
      h('div', {}, [
        h('h2', { text: 'Subject overview' }),
        h('p', { className: 'text-muted', text: `${activeSemester.academic_year} · ${activeSemester.term}` })
      ])
    ])
  ])
  if (!subjects.length) {
    overview.appendChild(h('div', { className: 'empty-state empty-state--compact' }, [
      h('strong', { text: 'No subjects in this semester yet' }),
      h('p', { text: 'Add your first subject to start tracking performance.' }),
      h('a', { className: 'button button--primary', href: '#/subjects', text: 'Add a subject' })
    ]))
  } else {
    const list = h('div', { className: 'dashboard-subject-list' })
    for (const { subject, average } of currentAverages) {
      const currentAverage = Number.isFinite(average) ? formatPercent(average) : 'No completed assessments'
      const finalGrade = formatFinalGrade(subject.final_grade, 'No final grade')
      list.appendChild(h('a', { className: 'dashboard-subject', href: `#/subjects/${subject.id}` }, [
        h('span', { className: 'dashboard-subject__name' }, [
          h('strong', { text: subject.code }),
          h('span', { text: subject.name })
        ]),
        h('span', {}, [h('span', { className: 'dashboard-subject__label', text: 'Current average' }), h('strong', { text: currentAverage })]),
        h('span', {}, [h('span', { className: 'dashboard-subject__label', text: 'Final grade' }), h('strong', { text: finalGrade })]),
        h('span', { className: 'text-muted', text: formatUnits(Number(subject.units)) })
      ]))
    }
    overview.appendChild(list)
  }

  const performance = h('section', { className: 'card dashboard-chart-card' }, [
    h('h2', { text: 'Performance by subject' })
  ])
  let chart = null
  let canvas = null
  if (completedAverages.length) {
    const summary = completedAverages
      .map(({ subject, average }) => `${subject.code}: ${formatPercent(average)}`)
      .join(' · ')
    canvas = h('canvas', { role: 'img', ariaLabel: `Current subject averages. ${summary}` })
    performance.append(
      h('div', { className: 'chart-container' }, [canvas]),
      h('p', { className: 'chart-summary', text: `Current averages: ${summary}` })
    )
  } else {
    performance.appendChild(h('p', { className: 'text-muted', text: 'Complete an assessment to see subject performance here.' }))
  }

  const assessmentSection = h('section', { className: 'card dashboard-assessments' }, [
    h('div', { className: 'section-heading' }, [
      h('div', {}, [h('h2', { text: 'Assessments' }), h('p', { className: 'text-muted', text: 'Overdue items and due dates in the next 14 days.' })]),
      h('a', { className: 'button button--secondary', href: '#/assessments', text: 'View all' })
    ]),
    assessmentList(bucket)
  ])
  const activitySection = h('section', { className: 'card dashboard-activity' }, [
    h('h2', { text: 'Recent activity' }),
    activityList(collectActivity(records.subjects, semesterLabels))
  ])
  const lowerGrid = h('div', { className: 'dashboard-lower-grid' }, [assessmentSection, activitySection])
  container.replaceChildren(heading, stats, overview, performance, lowerGrid, quickActions())
  if (canvas) {
    try {
      const { default: Chart } = await import('chart.js/auto')
      chart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: completedAverages.map(({ subject }) => subject.code),
          datasets: [{
            label: 'Current average (%)',
            data: completedAverages.map(({ average }) => average),
            backgroundColor: token('--accent', '#55c99a'),
            borderColor: token('--accent-strong', '#39ad7b'),
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: token('--text-muted', '#a8a8ad') }, grid: { color: token('--border', '#39393e') } },
            y: { beginAtZero: true, max: 100, ticks: { color: token('--text-muted', '#a8a8ad') }, grid: { color: token('--border', '#39393e') } }
          }
        }
      })
    } catch {
      performance.appendChild(h('p', { className: 'field-error', text: 'The performance chart could not load. The text summary above is still available.' }))
    }
  }
  return () => chart?.destroy()
}
