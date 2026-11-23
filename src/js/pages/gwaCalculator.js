import { loadAcademicRecords } from '../api/academicRecordsApi.js'
import { saveFinalGrade } from '../api/finalGradesApi.js'
import { updateSubject } from '../api/subjectsApi.js'
import { openModal } from '../components/modal.js'
import { toast } from '../components/notifications.js'
import { metricCard } from '../components/statCard.js'
import { computeCumulativeGwa, computeGwa } from '../services/gwaCalculator.js'
import { VALID_GRADES } from '../services/gradingRules.js'
import { dataErrorMessage } from '../utils/apiError.js'
import { h } from '../utils/dom.js'
import { formatFinalGrade, formatGwa, formatGrade, formatUnits } from '../utils/format.js'

const gradeStatuses = ['INC', 'IP', 'DR', 'WDRW']

function sourceText(subject) {
  const source = subject.final_grade?.source
  return source === 'computed' ? 'Computed' : source === 'manual' ? 'Manual' : '—'
}

function reasonText(subject) {
  if (subject.status) {
    return subject.reason === 'excluded_by_setting'
      ? `Final status: ${subject.status}; also excluded by the subject’s GWA setting`
      : `Final status: ${subject.status}`
  }
  if (subject.reason === 'excluded_by_setting') return 'Excluded by the subject’s GWA setting'
  if (subject.reason === 'invalid_units') return 'Units must be greater than zero'
  return 'No valid numeric final grade is saved'
}

function showManualGradeForm(subject, decimals, onSaved) {
  const form = h('form', { className: 'form' })
  const value = h('select', { id: 'gwa-manual-grade', required: true }, [
    h('option', { value: '', text: 'Choose a grade or status' }),
    ...VALID_GRADES.map(grade => h('option', {
      value: `grade:${grade}`,
      text: formatGrade(grade, decimals),
      selected: subject.final_grade?.status == null && Number(subject.final_grade?.grade_value) === grade
    })),
    ...gradeStatuses.map(status => h('option', {
      value: `status:${status}`,
      text: status,
      selected: subject.final_grade?.status === status
    }))
  ])
  const error = h('p', { className: 'field-error', ariaLive: 'polite' })
  const save = h('button', { className: 'button button--primary', type: 'submit', text: 'Save manual grade' })
  form.append(
    h('p', { className: 'text-muted', text: `${subject.code} · ${subject.name}` }),
    h('label', { for: 'gwa-manual-grade', text: 'Final grade' }),
    value,
    h('p', { className: 'text-muted', text: 'This saves a manual final grade. INC, IP, DR, and WDRW are stored as statuses, not numeric grades.' }),
    error,
    save
  )

  const close = openModal('Enter manual final grade', form)
  form.addEventListener('submit', async event => {
    event.preventDefault()
    error.textContent = ''
    const [kind, selected] = value.value.split(':')
    if (!selected || (kind === 'grade' && !VALID_GRADES.includes(Number(selected)))) {
      error.textContent = 'Choose a valid numeric grade or final status.'
      return
    }

    save.disabled = true
    try {
      const finalGrade = await saveFinalGrade(subject.id, {
        grade_value: kind === 'grade' ? Number(selected) : null,
        status: kind === 'status' ? selected : null,
        source: 'manual',
        percent_basis: null
      })
      onSaved(finalGrade)
      toast('Manual final grade saved.')
      close()
    } catch (saveError) {
      error.textContent = dataErrorMessage(saveError, 'Could not save this final grade.')
    } finally {
      save.disabled = false
    }
  })
}

function displayUncounted(target, result, subjects, title) {
  const section = h('section', { className: 'card gwa-uncounted' }, [
    h('h2', { text: title })
  ])
  if (!subjects.length) {
    section.appendChild(h('p', { className: 'text-muted', text: 'No subjects are available.' }))
  } else if (!result.uncounted.length) {
    section.appendChild(h('p', { className: 'text-muted', text: 'All subjects with valid final grades are counted.' }))
  } else {
    const list = h('ul', { className: 'gwa-uncounted-list' })
    for (const subject of result.uncounted) {
      list.appendChild(h('li', {}, [
        h('strong', { text: subject.name }),
        h('span', { text: `${formatUnits(subject.units)} not counted` }),
        h('span', { className: 'text-muted', text: reasonText(subject) })
      ]))
    }
    section.appendChild(list)
  }
  target.replaceChildren(section)
}

function makeWhatIfSubject(subject, choice) {
  if (!choice) return subject
  const [kind, value] = choice.split(':')
  return {
    ...subject,
    final_grade: kind === 'status'
      ? { grade_value: null, status: value }
      : { grade_value: Number(value), status: null }
  }
}

export async function render(container) {
  const heading = h('div', { className: 'page-heading' }, [
    h('div', {}, [
      h('p', { className: 'eyebrow', text: 'Academic performance' }),
      h('h1', { text: 'GWA' }),
      h('p', { className: 'text-muted', text: 'Semester and cumulative averages use unit-weighted final grades.' })
    ])
  ])
  const pageContent = h('div', { className: 'gwa-page-content' })
  container.replaceChildren(heading, h('div', { className: 'skeleton', ariaLabel: 'Loading GWA records' }))

  let records
  try {
    records = await loadAcademicRecords()
  } catch (error) {
    container.replaceChildren(heading, h('div', { className: 'empty-state' }, [
      h('strong', { text: 'Could not load GWA records' }),
      h('p', { text: dataErrorMessage(error, 'Try again in a moment.') })
    ]))
    return
  }

  const decimals = Number.isInteger(Number(records.profile?.gwa_decimals))
    ? Number(records.profile.gwa_decimals)
    : 2
  const selectedSemester = h('select', { id: 'gwa-semester', ariaLabel: 'Choose semester' })
  for (const semester of records.semesters) {
    selectedSemester.appendChild(h('option', {
      value: semester.id,
      text: `${semester.academic_year} · ${semester.term}`,
      selected: semester.id === records.profile?.active_semester_id
    }))
  }
  if (!selectedSemester.value && records.semesters[0]) selectedSemester.value = records.semesters[0].id
  const semesterPicker = h('div', { className: 'gwa-toolbar' }, [
    h('label', { for: 'gwa-semester', text: 'Semester' }),
    selectedSemester
  ])
  const includeNote = h('p', {
    className: 'text-muted gwa-help',
    text: 'Include settings are saved to each subject. Hypothetical grades below are never saved.'
  })
  const whatIfToggle = h('label', { className: 'checkbox-field gwa-what-if-toggle' }, [
    h('input', { type: 'checkbox', id: 'gwa-what-if' }),
    h('span', { text: 'What-if GWA (memory only)' })
  ])
  const stats = h('div', { className: 'stats-grid gwa-stats' })
  const whatIfStats = h('div', { className: 'stats-grid gwa-what-if-stats' })
  const rowsArea = h('div', { className: 'gwa-subjects' })
  const excludedArea = h('div', { className: 'gwa-excluded' })
  const whatIfExcludedArea = h('div', { className: 'gwa-excluded' })
  pageContent.append(
    semesterPicker,
    includeNote,
    whatIfToggle,
    stats,
    whatIfStats,
    rowsArea,
    excludedArea,
    whatIfExcludedArea
  )
  container.replaceChildren(heading, pageContent)

  const whatIfGrades = new Map()
  const savingSubjects = new Set()
  function draw() {
    const semester = records.semesterRecords.find(item => item.semester.id === selectedSemester.value)
    const semesterSubjects = semester?.subjects ?? []
    const semesterGwa = computeGwa(semesterSubjects)
    const cumulativeGwa = computeCumulativeGwa(records.subjects)
    stats.replaceChildren(
      metricCard('Semester GWA', formatGwa(semesterGwa.gwa, decimals)),
      metricCard('Units counted', formatUnits(semesterGwa.totalUnitsCounted)),
      metricCard('Units not counted', formatUnits(semesterGwa.totalUnitsUncounted), `${semesterGwa.uncounted.length} subject(s)`),
      metricCard('Cumulative GWA', formatGwa(cumulativeGwa.gwa, decimals), `${formatUnits(cumulativeGwa.totalUnitsCounted)} counted across all semesters`)
    )

    const whatIfActive = whatIfToggle.querySelector('input').checked
    whatIfStats.hidden = !whatIfActive
    whatIfExcludedArea.hidden = !whatIfActive
    let whatIfSemesterResult = null
    let whatIfCumulativeResult = null
    if (whatIfActive) {
      const whatIfSemesterSubjects = semesterSubjects.map(subject =>
        makeWhatIfSubject(subject, whatIfGrades.get(subject.id))
      )
      const selectedSemesterIds = new Set(semesterSubjects.map(subject => subject.id))
      const whatIfAllSubjects = records.subjects.map(subject => selectedSemesterIds.has(subject.id)
        ? makeWhatIfSubject(subject, whatIfGrades.get(subject.id))
        : subject)
      whatIfSemesterResult = computeGwa(whatIfSemesterSubjects)
      whatIfCumulativeResult = computeCumulativeGwa(whatIfAllSubjects)
      whatIfStats.replaceChildren(
        metricCard('What-if semester GWA', formatGwa(whatIfSemesterResult.gwa, decimals)),
        metricCard('What-if cumulative GWA', formatGwa(whatIfCumulativeResult.gwa, decimals), 'Hypothetical grades remain in memory only')
      )
      displayUncounted(whatIfExcludedArea, whatIfSemesterResult, whatIfSemesterSubjects, 'What-if subjects not counted')
    }

    if (!records.semesters.length) {
      rowsArea.replaceChildren(h('div', { className: 'empty-state' }, [
        h('strong', { text: 'No semesters yet' }),
        h('p', { text: 'Create a semester and add subjects to calculate GWA.' }),
        h('a', { className: 'button button--primary', href: '#/semesters', text: 'Go to semesters' })
      ]))
      excludedArea.replaceChildren()
      return
    }

    const table = h('table', { className: 'table gwa-table' })
    const headers = ['Subject', 'Units', 'Final grade', 'Include in GWA', 'Source']
    if (whatIfActive) headers.push('What-if grade/status')
    if (semesterSubjects.some(subject => subject.tracking_mode === 'manual')) headers.push('Manual grade')
    table.appendChild(h('thead', {}, [h('tr', {}, headers.map(label => h('th', { scope: 'col', text: label })))]))
    const body = h('tbody')
    for (const subject of semesterSubjects) {
      const include = h('input', {
        type: 'checkbox',
        checked: subject.counts_in_gwa !== false,
        ariaLabel: `Include ${subject.name} in GWA`
      })
      include.disabled = savingSubjects.has(subject.id)
      include.addEventListener('change', async () => {
        const previousValue = subject.counts_in_gwa !== false
        savingSubjects.add(subject.id)
        include.disabled = true
        try {
          await updateSubject(subject.id, { counts_in_gwa: include.checked })
          subject.counts_in_gwa = include.checked
          const cumulativeSubject = records.subjects.find(row => row.id === subject.id)
          if (cumulativeSubject) cumulativeSubject.counts_in_gwa = include.checked
          toast(include.checked ? 'Subject included in GWA.' : 'Subject excluded from GWA.')
        } catch (error) {
          include.checked = previousValue
          toast(dataErrorMessage(error, 'Could not update this subject’s GWA setting.'), 'error')
        } finally {
          savingSubjects.delete(subject.id)
          draw()
        }
      })
      const cells = [
        ['Subject', h('span', {}, [
          h('strong', { text: subject.code }),
          h('span', { className: 'gwa-subject-name', text: subject.name })
        ])],
        ['Units', h('span', { text: formatUnits(Number(subject.units)) })],
        ['Final grade', h('span', { text: formatFinalGrade(subject.final_grade, 'No final grade') })],
        ['Include in GWA', h('label', { className: 'checkbox-field' }, [include, h('span', { text: 'Include' })])],
        ['Source', h('span', { text: sourceText(subject) })]
      ]
      if (whatIfActive) {
        const hypothetical = h('select', {
          ariaLabel: `What-if grade for ${subject.name}`
        }, [
          h('option', { value: '', text: 'Use saved grade/status' }),
          ...VALID_GRADES.map(grade => h('option', {
            value: `grade:${grade}`,
            text: formatGrade(grade, decimals),
            selected: whatIfGrades.get(subject.id) === `grade:${grade}`
          })),
          ...gradeStatuses.map(status => h('option', {
            value: `status:${status}`,
            text: status,
            selected: whatIfGrades.get(subject.id) === `status:${status}`
          }))
        ])
        hypothetical.addEventListener('change', () => {
          if (hypothetical.value) whatIfGrades.set(subject.id, hypothetical.value)
          else whatIfGrades.delete(subject.id)
          draw()
        })
        cells.push(['What-if grade/status', hypothetical])
      }
      if (subject.tracking_mode === 'manual') {
        const edit = h('button', {
          className: 'button button--secondary',
          type: 'button',
          text: subject.final_grade ? 'Edit grade' : 'Set grade'
        })
        edit.addEventListener('click', () => showManualGradeForm(subject, decimals, finalGrade => {
          subject.final_grade = finalGrade
          const cumulativeSubject = records.subjects.find(row => row.id === subject.id)
          if (cumulativeSubject) cumulativeSubject.final_grade = finalGrade
          draw()
        }))
        cells.push(['Manual grade', edit])
      }
      const row = h('tr')
      for (const [label, content] of cells) {
        row.appendChild(h('td', { dataLabel: label }, [content]))
      }
      body.appendChild(row)
    }
    table.appendChild(body)
    rowsArea.replaceChildren(
      semesterSubjects.length
        ? h('div', { className: 'table-wrap gwa-table-wrap' }, [table])
        : h('div', { className: 'empty-state' }, [
          h('strong', { text: 'No subjects in this semester' }),
          h('p', { text: 'Add subjects to calculate a semester GWA.' })
        ])
    )
    displayUncounted(excludedArea, semesterGwa, semesterSubjects, 'Semester subjects not counted')
  }

  selectedSemester.addEventListener('change', draw)
  whatIfToggle.querySelector('input').addEventListener('change', draw)
  draw()
}
