import { h } from '../utils/dom.js'
import { listSubjects, createSubject, updateSubject, deleteSubject } from '../api/subjectsApi.js'
import { getSemesterContext } from '../api/semestersApi.js'
import { toast } from '../components/notifications.js'
import { openModal, confirmDialog } from '../components/modal.js'
import { validateRequired, validateUnits } from '../utils/validate.js'
import { formatGrade, formatPercent, formatUnits } from '../utils/format.js'
import { computeSubjectGrade } from '../services/gradeCalculator.js'
import { dataErrorMessage } from '../utils/apiError.js'

function addField(form, labelText, input, error) {
  form.append(h('label', { for: input.id, text: labelText }), input)
  if (error) form.append(error)
}

function showSubjectForm(existing, semester, onSaved) {
  const form = h('form', { className: 'form subject-form' })
  const code = h('input', { id: 'subject-code', required: true, value: existing?.code ?? '', maxlength: 32 })
  const codeError = h('p', { className: 'field-error', ariaLive: 'polite' })
  const name = h('input', { id: 'subject-name', required: true, value: existing?.name ?? '', maxlength: 120 })
  const nameError = h('p', { className: 'field-error', ariaLive: 'polite' })
  const units = h('input', { id: 'subject-units', type: 'number', step: '0.01', min: '0.01', max: '12', required: true, value: existing?.units ?? '' })
  const unitsError = h('p', { className: 'field-error', ariaLive: 'polite' })
  const instructor = h('input', { id: 'subject-instructor', value: existing?.instructor ?? '', maxlength: 120 })
  const tracking = h('select', { id: 'subject-tracking' }, [
    h('option', { value: 'assessments', text: 'Assessments', selected: !existing || existing.tracking_mode === 'assessments' }),
    h('option', { value: 'manual', text: 'Manual grade', selected: existing?.tracking_mode === 'manual' })
  ])
  const weighting = h('select', { id: 'subject-weighting' }, [
    h('option', { value: 'individual', text: 'Individual weighting', selected: !existing || existing.weighting_mode === 'individual' }),
    h('option', { value: 'category', text: 'Category weighting', selected: existing?.weighting_mode === 'category' })
  ])
  const counts = h('input', { id: 'subject-counts-in-gwa', type: 'checkbox', checked: existing?.counts_in_gwa !== false })
  const countsLabel = h('label', { className: 'checkbox-field', for: 'subject-counts-in-gwa' }, [
    counts,
    h('span', { text: 'Count this subject in GWA' })
  ])
  const serverError = h('p', { className: 'field-error', ariaLive: 'polite' })
  const submit = h('button', { className: 'button button--primary', type: 'submit', text: existing ? 'Save changes' : 'Add subject' })
  addField(form, 'Subject code', code, codeError)
  addField(form, 'Subject name', name, nameError)
  addField(form, 'Units', units, unitsError)
  addField(form, 'Instructor (optional)', instructor)
  addField(form, 'Tracking mode', tracking)
  addField(form, 'Weighting mode', weighting)
  form.append(countsLabel, serverError, submit)

  const close = openModal(existing ? 'Edit subject' : 'Add subject', form)
  form.addEventListener('submit', async event => {
    event.preventDefault()
    codeError.textContent = validateRequired(code.value, 'Subject code')
    nameError.textContent = validateRequired(name.value, 'Subject name')
    unitsError.textContent = validateUnits(Number(units.value))
    serverError.textContent = ''
    if (codeError.textContent || nameError.textContent || unitsError.textContent) return

    submit.disabled = true
    try {
      const values = {
        semester_id: semester.id,
        code: code.value.trim(),
        name: name.value.trim(),
        units: Number(units.value),
        instructor: instructor.value.trim() || null,
        tracking_mode: tracking.value,
        weighting_mode: weighting.value,
        counts_in_gwa: counts.checked
      }
      if (existing) await updateSubject(existing.id, values)
      else await createSubject(values)
      toast(existing ? 'Subject updated.' : 'Subject added.')
      close()
      await onSaved()
    } catch (error) {
      serverError.textContent = dataErrorMessage(error, 'Could not save the subject.')
    } finally {
      submit.disabled = false
    }
  })
}

function subjectTable(subjects, semester, reload) {
  const table = h('table', { className: 'table subjects-table' })
  table.appendChild(h('thead', {}, [
    h('tr', {}, ['Code', 'Subject', 'Units', 'Instructor', 'Tracking', 'Current grade', 'Final grade status', ''].map(text => h('th', { scope: 'col', text })))
  ]))
  const body = h('tbody')
  for (const subject of subjects) {
    const calculation = computeSubjectGrade(
      subject,
      subject.assessment_categories || [],
      subject.assessments || []
    )
    const finalGrade = Array.isArray(subject.final_grades)
      ? subject.final_grades[0]
      : subject.final_grades
    const currentGrade = subject.tracking_mode === 'manual'
      ? formatGrade(finalGrade?.grade_value)
      : formatPercent(calculation.currentAverage)
    const finalStatus = finalGrade
      ? finalGrade.status || 'Recorded'
      : 'Not set'
    const row = h('tr')
    const codeLink = h('a', { href: `#/subjects/${subject.id}`, text: subject.code })
    const nameLink = h('a', { href: `#/subjects/${subject.id}`, text: subject.name })
    const actions = h('div', { className: 'subject-actions' })
    const edit = h('button', { className: 'button button--secondary', type: 'button', text: 'Edit', ariaLabel: `Edit ${subject.code}` })
    edit.addEventListener('click', () => showSubjectForm(subject, semester, reload))
    const remove = h('button', { className: 'button button--danger', type: 'button', text: 'Delete', ariaLabel: `Delete ${subject.code}` })
    remove.addEventListener('click', async () => {
      const confirmed = await confirmDialog({
        title: 'Delete subject?',
        message: 'This permanently deletes the subject, its assessment categories, assessments, and final grade.',
        confirmText: 'Delete subject',
        danger: true
      })
      if (!confirmed) return
      remove.disabled = true
      try {
        await deleteSubject(subject.id)
        toast('Subject deleted.')
        await reload()
      } catch (error) {
        toast(dataErrorMessage(error, 'Could not delete the subject.'), 'error')
      } finally {
        remove.disabled = false
      }
    })
    actions.append(edit, remove)
    const cells = [
      ['Code', codeLink],
      ['Subject', nameLink],
      ['Units', h('span', { text: formatUnits(Number(subject.units)) })],
      ['Instructor', h('span', { text: subject.instructor || '—' })],
      ['Tracking', h('span', { text: subject.tracking_mode === 'manual' ? 'Manual' : 'Assessments' })],
      ['Current grade', h('span', { text: currentGrade })],
      ['Final grade status', h('span', { text: finalStatus })],
      ['Actions', actions]
    ]
    for (const [label, content] of cells) {
      row.appendChild(h('td', { dataLabel: label }, [content]))
    }
    body.appendChild(row)
  }
  table.appendChild(body)
  return h('div', { className: 'table-wrap subjects-table-wrap' }, [table])
}

export async function render(container) {
  let disposed = false
  let loadId = 0
  const heading = h('div', { className: 'page-heading' })
  const add = h('button', { className: 'button button--primary', type: 'button', text: '+ Add subject' })
  heading.append(h('h1', { text: 'Subjects' }), add)
  const total = h('p', { className: 'subject-units-summary', ariaLive: 'polite' })
  const list = h('div', { className: 'subjects-list' })
  container.replaceChildren(heading, total, list)

  async function load() {
    const requestId = ++loadId
    list.replaceChildren(h('div', { className: 'skeleton', ariaLabel: 'Loading subjects' }))
    try {
      const { selected } = await getSemesterContext()
      if (disposed || requestId !== loadId) return
      if (!selected) {
        total.textContent = 'Total units: 0'
        list.replaceChildren(h('div', { className: 'empty-state' }, [
          h('strong', { text: 'Choose a semester first' }),
          h('p', { text: 'Add a semester before adding subjects.' }),
          h('a', { className: 'button button--primary', href: '#/semesters', text: 'Go to semesters' })
        ]))
        return
      }

      const subjects = await listSubjects(selected.id)
      if (disposed || requestId !== loadId) return
      total.textContent = `${selected.academic_year} · ${selected.term} — Total units: ${formatUnits(
        subjects.reduce((sum, subject) => sum + Number(subject.units), 0)
      )}`
      if (!subjects.length) {
        list.replaceChildren(h('div', { className: 'empty-state' }, [
          h('strong', { text: 'No subjects in this semester' }),
          h('p', { text: 'Add a subject to start tracking grades.' })
        ]))
      } else {
        list.replaceChildren(subjectTable(subjects, selected, load))
      }
    } catch (error) {
      if (disposed || requestId !== loadId) return
      total.textContent = ''
      list.replaceChildren(h('div', { className: 'empty-state' }, [
        h('strong', { text: 'Could not load subjects' }),
        h('p', { text: dataErrorMessage(error, 'Try again in a moment.') })
      ]))
    }
  }

  const onSemesterChanged = () => { load() }
  window.addEventListener('semester:changed', onSemesterChanged)
  add.addEventListener('click', async () => {
    try {
      const { selected } = await getSemesterContext()
      if (!selected) {
        toast('Add a semester before adding subjects.', 'error')
        return
      }
      showSubjectForm(null, selected, load)
    } catch (error) {
      toast(dataErrorMessage(error, 'Could not load semesters.'), 'error')
    }
  })
  await load()
  return () => {
    disposed = true
    window.removeEventListener('semester:changed', onSemesterChanged)
  }
}
