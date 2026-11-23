import { h } from '../utils/dom.js'
import {
  listSemesters,
  createSemester,
  updateSemester,
  setActiveSemester,
  archiveSemester,
  deleteSemester
} from '../api/semestersApi.js'
import { validateAcademicYear } from '../utils/validate.js'
import { toast } from '../components/notifications.js'
import { openModal, confirmDialog } from '../components/modal.js'
import { formatDate } from '../utils/format.js'
import { dataErrorMessage } from '../utils/apiError.js'

function emitSemestersChanged() {
  window.dispatchEvent(new Event('semesters:changed'))
}

function showSemesterForm(existing, onSaved) {
  const form = h('form', { className: 'form' })
  const year = h('input', { id: 'semester-year', required: true, placeholder: '2026-2027', value: existing?.academic_year ?? '' })
  const yearError = h('p', { className: 'field-error', ariaLive: 'polite' })
  const term = h('select', { id: 'semester-term' }, ['1st', '2nd', 'midyear'].map(value => h('option', {
    value,
    text: value === 'midyear' ? 'Midyear' : `${value} semester`,
    selected: value === existing?.term
  })))
  const start = h('input', { id: 'semester-start', type: 'date', required: true, value: existing?.start_date ?? '' })
  const end = h('input', { id: 'semester-end', type: 'date', value: existing?.end_date ?? '' })
  const dateError = h('p', { className: 'field-error', ariaLive: 'polite' })
  const status = existing ? null : h('select', { id: 'semester-status' }, [
    h('option', { value: 'active', text: 'Active semester' }),
    h('option', { value: 'archived', text: 'Archived semester' })
  ])
  const statusError = existing ? null : h('p', { className: 'field-error', ariaLive: 'polite' })
  const submit = h('button', { className: 'button button--primary', type: 'submit', text: existing ? 'Save changes' : 'Add semester' })
  form.append(
    h('label', { for: 'semester-year', text: 'Academic year' }), year, yearError,
    h('label', { for: 'semester-term', text: 'Term' }), term,
    h('label', { for: 'semester-start', text: 'Start date' }), start,
    h('label', { for: 'semester-end', text: 'End date (optional)' }), end,
    ...(status ? [h('label', { for: 'semester-status', text: 'Status' }), status, statusError] : []),
    dateError, submit
  )

  const close = openModal(existing ? 'Edit semester' : 'Add semester', form)
  form.addEventListener('submit', async event => {
    event.preventDefault()
    yearError.textContent = validateAcademicYear(year.value)
    dateError.textContent = !start.value
      ? 'Start date is required.'
      : end.value && end.value < start.value
        ? 'End date must be on or after the start date.'
        : ''
    if (yearError.textContent || dateError.textContent) return

    submit.disabled = true
    try {
      const values = {
        academic_year: year.value.trim(),
        term: term.value,
        start_date: start.value,
        end_date: end.value || null
      }
      if (existing) await updateSemester(existing.id, values)
      else await createSemester({ ...values, status: status.value })
      toast(existing ? 'Semester updated.' : 'Semester added.')
      close()
      emitSemestersChanged()
      await onSaved()
    } catch (error) {
      const message = error?.code === '23505'
        ? 'A semester for this academic year and term already exists.'
        : dataErrorMessage(error, 'Could not save the semester.')
      if (error?.code === '23505') yearError.textContent = message
      else toast(message, 'error')
    } finally {
      submit.disabled = false
    }
  })
}

export async function render(container) {
  let disposed = false
  const heading = h('div', { className: 'page-heading' })
  const add = h('button', { className: 'button button--primary', type: 'button', text: '+ Add semester' })
  heading.append(h('h1', { text: 'Semesters' }), add)
  const list = h('div', { className: 'semester-list' })
  container.replaceChildren(heading, list)

  async function load() {
    list.replaceChildren(h('div', { className: 'skeleton', ariaLabel: 'Loading semesters' }))
    try {
      const semesters = await listSemesters()
      if (disposed) return
      if (!semesters.length) {
        list.replaceChildren(h('div', { className: 'empty-state' }, [
          h('strong', { text: 'No semesters yet' }),
          h('p', { text: 'Add your first semester to start tracking subjects.' })
        ]))
        return
      }

      const cards = semesters.map(semester => {
        const card = h('article', { className: 'card semester-card' })
        const title = h('div', { className: 'semester-card__heading' }, [
          h('div', {}, [
            h('h2', { text: `${semester.academic_year} · ${semester.term}` }),
            h('p', {
              className: 'text-muted',
              text: semester.end_date
                ? `${formatDate(semester.start_date)} – ${formatDate(semester.end_date)}`
                : `Starts ${formatDate(semester.start_date)}`
            })
          ]),
          h('span', {
            className: `badge ${semester.status === 'active' ? 'badge--success' : ''}`,
            text: semester.status === 'active' ? 'Active' : 'Archived'
          })
        ])
        const actions = h('div', { className: 'button-row semester-card__actions' })
        const edit = h('button', { className: 'button button--secondary', type: 'button', text: 'Edit' })
        edit.addEventListener('click', () => showSemesterForm(semester, load))
        actions.appendChild(edit)

        if (semester.status === 'active') {
          const archive = h('button', { className: 'button button--secondary', type: 'button', text: 'Archive' })
          archive.addEventListener('click', async () => {
            archive.disabled = true
            try {
              await archiveSemester(semester.id)
              toast('Semester archived.')
              emitSemestersChanged()
              await load()
            } catch (error) {
              toast(dataErrorMessage(error, 'Could not archive the semester.'), 'error')
            } finally {
              archive.disabled = false
            }
          })
          actions.appendChild(archive)
        } else {
          const activate = h('button', { className: 'button button--primary', type: 'button', text: 'Set active' })
          activate.addEventListener('click', async () => {
            activate.disabled = true
            try {
              await setActiveSemester(semester.id)
              toast('Active semester updated.')
              emitSemestersChanged()
              await load()
            } catch (error) {
              toast(dataErrorMessage(error, 'Could not set the active semester.'), 'error')
            } finally {
              activate.disabled = false
            }
          })
          actions.appendChild(activate)
        }

        const remove = h('button', { className: 'button button--danger', type: 'button', text: 'Delete' })
        remove.addEventListener('click', async () => {
          const confirmed = await confirmDialog({
            title: 'Delete semester?',
            message: 'This permanently deletes the semester and cascades to its subjects, categories, assessments, and final grades.',
            confirmText: 'Delete semester',
            danger: true
          })
          if (!confirmed) return
          remove.disabled = true
          try {
            await deleteSemester(semester.id)
            toast('Semester deleted.')
            emitSemestersChanged()
            await load()
          } catch (error) {
            toast(dataErrorMessage(error, 'Could not delete the semester.'), 'error')
          } finally {
            remove.disabled = false
          }
        })
        actions.appendChild(remove)
        card.append(title, actions)
        return card
      })
      list.replaceChildren(...cards)
    } catch (error) {
      if (disposed) return
      list.replaceChildren(h('div', { className: 'empty-state' }, [
        h('strong', { text: 'Could not load semesters' }),
        h('p', { text: dataErrorMessage(error, 'Try again in a moment.') })
      ]))
    }
  }

  add.addEventListener('click', () => showSemesterForm(null, load))
  await load()
  return () => { disposed = true }
}
