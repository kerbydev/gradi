import { h } from '../utils/dom.js'
import { getSubject } from '../api/subjectsApi.js'
import {
  createAssessment,
  updateAssessment,
  deleteAssessment
} from '../api/assessmentsApi.js'
import {
  createAssessmentCategory,
  updateAssessmentCategory,
  deleteAssessmentCategory
} from '../api/assessmentCategoriesApi.js'
import { computeAssessmentPercentage, computeSubjectGrade } from '../services/gradeCalculator.js'
import { createCalculationPanel, createPredictorPanel } from '../components/subjectGradeTools.js'
import { createFinalGradePanel } from '../components/finalGradePanel.js'
import { formatDate, formatPercent, formatNumber } from '../utils/format.js'
import { validateAssessmentValues, validateRequired, validateWeight } from '../utils/validate.js'
import { toast } from '../components/notifications.js'
import { openModal, confirmDialog } from '../components/modal.js'
import { dataErrorMessage } from '../utils/apiError.js'

const CATEGORY_TYPES = [
  ['quiz', 'Quiz'],
  ['exam', 'Exam'],
  ['laboratory', 'Laboratory'],
  ['assignment', 'Assignment'],
  ['project', 'Project'],
  ['recitation', 'Recitation'],
  ['activity', 'Activity'],
  ['other', 'Other']
]
const WEIGHT_TOLERANCE = 0.0001

function categoryTypeLabel(type) {
  return CATEGORY_TYPES.find(([value]) => value === type)?.[1] ?? type
}

function showCategoryForm(subject, weightingMode, existing, onSaved) {
  const form = h('form', { className: 'form' })
  const name = h('input', { id: 'category-name', required: true, maxlength: 120, value: existing?.name ?? '' })
  const nameError = h('p', { className: 'field-error', ariaLive: 'polite' })
  const type = h('select', { id: 'category-type' }, CATEGORY_TYPES.map(([value, label]) => h('option', {
    value,
    text: label,
    selected: value === existing?.type
  })))
  const weight = weightingMode === 'category'
    ? h('input', {
      id: 'category-weight',
      type: 'number',
      min: '0',
      max: '100',
      step: '0.01',
      placeholder: 'For example, 20',
      value: existing?.weight ?? ''
    })
    : null
  const weightError = h('p', { className: 'field-error', ariaLive: 'polite' })
  const serverError = h('p', { className: 'field-error', ariaLive: 'polite' })
  const submit = h('button', { className: 'button button--primary', type: 'submit', text: existing ? 'Save category' : 'Add category' })
  form.append(
    h('label', { for: 'category-name', text: 'Category name' }), name, nameError,
    h('label', { for: 'category-type', text: 'Type' }), type
  )
  if (weight) form.append(h('label', { for: 'category-weight', text: 'Category weight (%)' }), weight, weightError)
  form.append(serverError, submit)

  const close = openModal(existing ? 'Edit category' : 'Add category', form)
  form.addEventListener('submit', async event => {
    event.preventDefault()
    nameError.textContent = validateRequired(name.value, 'Category name')
    weightError.textContent = weight && weight.value !== '' ? validateWeight(Number(weight.value)) : ''
    serverError.textContent = ''
    if (nameError.textContent || weightError.textContent) return

    submit.disabled = true
    try {
      const values = {
        subject_id: subject.id,
        name: name.value.trim(),
        type: type.value
      }
      if (weight) values.weight = weight.value === '' ? null : Number(weight.value)
      else if (existing) values.weight = existing.weight
      if (existing) await updateAssessmentCategory(existing.id, values)
      else await createAssessmentCategory(values)
      toast(existing ? 'Category updated.' : 'Category added.')
      close()
      await onSaved()
    } catch (error) {
      serverError.textContent = dataErrorMessage(error, 'Could not save the category.')
    } finally {
      submit.disabled = false
    }
  })
}

function showAssessmentForm(subject, categories, existing, onSaved) {
  const form = h('form', { className: 'form assessment-form' })
  const category = h('select', { id: 'assessment-category', required: true }, categories.map(item => h('option', {
    value: item.id,
    text: `${item.name} · ${categoryTypeLabel(item.type)}`,
    selected: item.id === existing?.category_id
  })))
  const name = h('input', { id: 'assessment-name', required: true, maxlength: 160, value: existing?.name ?? '' })
  const nameError = h('p', { className: 'field-error', ariaLive: 'polite' })
  const method = h('select', { id: 'assessment-input-method' }, [
    h('option', { value: 'raw', text: 'Raw score', selected: !existing || existing.input_method === 'raw' }),
    h('option', { value: 'percent', text: 'Direct percentage', selected: existing?.input_method === 'percent' })
  ])
  const score = h('input', {
    id: 'assessment-score',
    type: 'number',
    min: '0',
    max: '999999.99',
    step: '0.01',
    value: existing?.score ?? ''
  })
  const total = h('input', {
    id: 'assessment-total',
    type: 'number',
    min: '0.01',
    max: '999999.99',
    step: '0.01',
    value: existing?.total_points ?? ''
  })
  const percentage = h('input', {
    id: 'assessment-percentage',
    type: 'number',
    min: '0',
    max: '100',
    step: '0.01',
    value: existing?.percentage ?? ''
  })
  const rawGroup = h('div', { className: 'assessment-input-group inline-fields' }, [
    h('div', { className: 'form' }, [h('label', { for: 'assessment-score', text: 'Score' }), score]),
    h('div', { className: 'form' }, [h('label', { for: 'assessment-total', text: 'Total points' }), total])
  ])
  const percentageGroup = h('div', { className: 'assessment-input-group' }, [
    h('label', { for: 'assessment-percentage', text: 'Percentage (%)' }),
    percentage
  ])
  const weight = h('input', {
    id: 'assessment-weight',
    type: 'number',
    min: '0',
    max: '100',
    step: '0.01',
    required: true,
    value: existing?.weight ?? ''
  })
  const weightLabel = h('label', {
    for: 'assessment-weight',
    text: subject.weighting_mode === 'category' ? 'Relative weight (%)' : 'Weight (%)'
  })
  const weightError = h('p', { className: 'field-error', ariaLive: 'polite' })
  const dueDate = h('input', { id: 'assessment-due-date', type: 'date', value: existing?.due_date ?? '' })
  const completed = h('input', { id: 'assessment-completed', type: 'checkbox', checked: existing?.is_completed === true })
  const completedLabel = h('label', { className: 'checkbox-field', for: 'assessment-completed' }, [
    completed,
    h('span', { text: 'Mark as completed' })
  ])
  const computed = h('p', { className: 'assessment-preview', ariaLive: 'polite' })
  const error = h('p', { className: 'field-error', ariaLive: 'polite' })
  const submit = h('button', { className: 'button button--primary', type: 'submit', text: existing ? 'Save changes' : 'Add assessment' })
  form.append(
    h('label', { for: 'assessment-category', text: 'Category' }), category,
    h('label', { for: 'assessment-name', text: 'Assessment name' }), name, nameError,
    h('label', { for: 'assessment-input-method', text: 'Score input' }), method,
    rawGroup, percentageGroup,
    weightLabel, weight, weightError,
    h('label', { for: 'assessment-due-date', text: 'Due date (optional)' }), dueDate,
    completedLabel, computed, error, submit
  )

  function updateInputMethod() {
    const raw = method.value === 'raw'
    rawGroup.hidden = !raw
    percentageGroup.hidden = raw
    score.disabled = !raw
    total.disabled = !raw
    percentage.disabled = raw
    weightLabel.textContent = subject.weighting_mode === 'category' ? 'Relative weight (%)' : 'Weight (%)'
  }

  function updateComputedPercentage() {
    const assessment = method.value === 'raw'
      ? {
        input_method: 'raw',
        score: score.value === '' ? null : Number(score.value),
        total_points: total.value === '' ? null : Number(total.value)
      }
      : {
        input_method: 'percent',
        percentage: percentage.value === '' ? null : Number(percentage.value)
      }
    computed.textContent = `Computed percentage: ${formatPercent(computeAssessmentPercentage(assessment))}`
  }

  method.addEventListener('change', () => {
    updateInputMethod()
    updateComputedPercentage()
  })
  for (const input of [score, total, percentage]) {
    input.addEventListener('input', updateComputedPercentage)
  }
  updateInputMethod()
  updateComputedPercentage()

  const close = openModal(existing ? 'Edit assessment' : 'Add assessment', form)
  form.addEventListener('submit', async event => {
    event.preventDefault()
    nameError.textContent = validateRequired(name.value, 'Assessment name')
    weightError.textContent = weight.value === '' ? 'Weight is required.' : validateWeight(Number(weight.value))
    error.textContent = ''
    if (nameError.textContent || weightError.textContent) return

    const values = {
      subject_id: subject.id,
      category_id: category.value,
      name: name.value.trim(),
      input_method: method.value,
      score: method.value === 'raw' && score.value !== '' ? Number(score.value) : null,
      total_points: method.value === 'raw' && total.value !== '' ? Number(total.value) : null,
      percentage: method.value === 'percent' && percentage.value !== '' ? Number(percentage.value) : null,
      weight: Number(weight.value),
      due_date: dueDate.value || null,
      is_completed: completed.checked
    }
    const validation = validateAssessmentValues(values)
    if (validation) {
      error.textContent = validation
      return
    }

    submit.disabled = true
    try {
      if (existing) await updateAssessment(existing.id, values)
      else await createAssessment(values)
      toast(existing ? 'Assessment updated.' : 'Assessment added.')
      close()
      await onSaved()
    } catch (saveError) {
      error.textContent = dataErrorMessage(saveError, 'Could not save the assessment.')
    } finally {
      submit.disabled = false
    }
  })
}

function renderCategoryManager(subject, categories, onSaved) {
  const section = h('section', { className: 'card category-manager' })
  const heading = h('div', { className: 'section-heading' })
  const add = h('button', { className: 'button button--secondary', type: 'button', text: '+ Add category' })
  heading.append(h('h2', { text: 'Categories' }), add)
  section.appendChild(heading)
  add.addEventListener('click', () => showCategoryForm(subject, subject.weighting_mode, null, onSaved))

  if (!categories.length) {
    section.appendChild(h('div', { className: 'empty-state' }, [
      h('strong', { text: 'No categories yet' }),
      h('p', { text: 'Add a category before adding assessments.' })
    ]))
    return section
  }

  const list = h('div', { className: 'category-list' })
  for (const item of categories) {
    const row = h('article', { className: 'category-row' })
    const details = h('div', { className: 'category-row__details' }, [
      h('strong', { text: item.name }),
      h('span', { className: 'badge', text: categoryTypeLabel(item.type) })
    ])
    if (subject.weighting_mode === 'category') {
      details.appendChild(h('span', {
        className: 'text-muted',
        text: item.weight == null ? 'Category weight not set' : `Category weight: ${formatPercent(Number(item.weight))}`
      }))
    }
    const actions = h('div', { className: 'subject-actions' })
    const edit = h('button', { className: 'button button--secondary', type: 'button', text: 'Edit', ariaLabel: `Edit ${item.name}` })
    edit.addEventListener('click', () => showCategoryForm(subject, subject.weighting_mode, item, onSaved))
    const remove = h('button', { className: 'button button--danger', type: 'button', text: 'Delete', ariaLabel: `Delete ${item.name}` })
    remove.addEventListener('click', async () => {
      const confirmed = await confirmDialog({
        title: 'Delete category?',
        message: 'Deleting this category also deletes its assessments.',
        confirmText: 'Delete category',
        danger: true
      })
      if (!confirmed) return
      remove.disabled = true
      try {
        await deleteAssessmentCategory(item.id)
        toast('Category deleted.')
        await onSaved()
      } catch (error) {
        toast(dataErrorMessage(error, 'Could not delete the category.'), 'error')
      } finally {
        remove.disabled = false
      }
    })
    actions.append(edit, remove)
    row.append(details, actions)
    list.appendChild(row)
  }
  section.appendChild(list)
  return section
}

function renderWeights(subject, categories, assessments, result) {
  const section = h('section', { className: 'weight-section' })
  const validTotal = Math.abs(result.totalConfiguredWeight - 100) <= WEIGHT_TOLERANCE
  const hasWarnings = result.weightWarnings.length > 0
  const meter = h('div', {
    className: `weight-meter${validTotal && !hasWarnings ? '' : ' weight-meter--warning'}`,
    role: 'status'
  })

  if (subject.weighting_mode === 'category') {
    meter.appendChild(h('p', {
      text: `Category weights total ${formatNumber(result.totalConfiguredWeight, 2)}% / remaining ${formatNumber(result.remainingWeight, 2)}%`
    }))
    for (const category of categories) {
      const relativeTotal = assessments
        .filter(assessment => assessment.category_id === category.id)
        .reduce((sum, assessment) => sum + Number(assessment.weight || 0), 0)
      const correct = Math.abs(relativeTotal - 100) <= WEIGHT_TOLERANCE
      meter.appendChild(h('p', {
        className: correct ? '' : 'weight-meter__warning',
        text: `${category.name} relative weights: ${formatNumber(relativeTotal, 2)}%${correct ? '' : ' (expected 100%)'}`
      }))
    }
  } else {
    meter.appendChild(h('p', {
      text: `Weights total ${formatNumber(result.totalConfiguredWeight, 2)}% / remaining ${formatNumber(result.remainingWeight, 2)}%`
    }))
  }

  if (hasWarnings) {
    const warnings = h('ul', { className: 'weight-warning-list' })
    for (const warning of result.weightWarnings) warnings.appendChild(h('li', { text: warning }))
    meter.appendChild(warnings)
  }
  section.appendChild(meter)
  return section
}

function renderAssessments(subject, categories, assessments, onSaved) {
  const section = h('section', { className: 'assessment-groups' })
  if (!categories.length) return section

  for (const category of categories) {
    const group = h('article', { className: 'assessment-category' })
    const groupHeading = h('div', { className: 'assessment-category__heading' }, [
      h('div', {}, [
        h('h3', { text: category.name }),
        h('span', { className: 'badge', text: categoryTypeLabel(category.type) })
      ])
    ])
    if (subject.weighting_mode === 'category') {
      groupHeading.appendChild(h('span', {
        className: 'text-muted',
        text: category.weight == null ? 'Weight not set' : `Category weight: ${formatPercent(Number(category.weight))}`
      }))
    }
    group.appendChild(groupHeading)

    const rows = assessments.filter(assessment => assessment.category_id === category.id)
    if (!rows.length) {
      group.appendChild(h('div', { className: 'empty-state empty-state--compact', text: 'No assessments in this category.' }))
    } else {
      const table = h('table', { className: 'table assessment-table' })
      table.appendChild(h('thead', {}, [
        h('tr', {}, ['Name', 'Type', 'Score / total', 'Computed %', 'Weight', 'Due date', 'Status', 'Actions']
          .map(label => h('th', { scope: 'col', text: label })))
      ]))
      const body = h('tbody')
      for (const assessment of rows) {
        const computedPercent = computeAssessmentPercentage(assessment)
        const rawScore = assessment.input_method === 'raw'
          && assessment.score != null
          && assessment.total_points != null
          ? `${assessment.score}/${assessment.total_points}`
          : assessment.input_method === 'percent' && assessment.percentage != null
            ? formatPercent(Number(assessment.percentage))
            : '—'
        const edit = h('button', { className: 'button button--secondary', type: 'button', text: 'Edit', ariaLabel: `Edit ${assessment.name}` })
        edit.addEventListener('click', () => showAssessmentForm(subject, categories, assessment, onSaved))
        const remove = h('button', { className: 'button button--danger', type: 'button', text: 'Delete', ariaLabel: `Delete ${assessment.name}` })
        remove.addEventListener('click', async () => {
          const confirmed = await confirmDialog({
            title: 'Delete assessment?',
            message: `Delete "${assessment.name}"? This cannot be undone.`,
            confirmText: 'Delete assessment',
            danger: true
          })
          if (!confirmed) return
          remove.disabled = true
          try {
            await deleteAssessment(assessment.id)
            toast('Assessment deleted.')
            await onSaved()
          } catch (error) {
            toast(dataErrorMessage(error, 'Could not delete the assessment.'), 'error')
          } finally {
            remove.disabled = false
          }
        })
        const actions = h('div', { className: 'subject-actions' }, [edit, remove])
        const cells = [
          ['Name', h('strong', { text: assessment.name })],
          ['Type', h('span', { text: categoryTypeLabel(category.type) })],
          ['Score / total', h('span', { text: rawScore })],
          ['Computed %', h('span', { text: formatPercent(computedPercent) })],
          ['Weight', h('span', {
            text: `${formatPercent(Number(assessment.weight))}${subject.weighting_mode === 'category' ? ' relative' : ''}`
          })],
          ['Due date', h('span', { text: formatDate(assessment.due_date) })],
          ['Status', h('span', {
            className: `badge ${assessment.is_completed ? 'badge--success' : 'badge--warning'}`,
            text: assessment.is_completed ? 'Completed' : 'Incomplete'
          })],
          ['Actions', actions]
        ]
        const row = h('tr')
        for (const [label, content] of cells) row.appendChild(h('td', { dataLabel: label }, [content]))
        body.appendChild(row)
      }
      table.appendChild(body)
      group.appendChild(h('div', { className: 'table-wrap assessment-table-wrap' }, [table]))
    }
    section.appendChild(group)
  }
  return section
}

function createAssessmentPanel(subject, categories, assessments, onSaved, result) {
  const summary = h('div', { className: 'stats-grid' }, [
    h('article', { className: 'stat-card' }, [
      h('span', { className: 'stat-card__label', text: 'Earned' }),
      h('strong', { className: 'stat-card__value', text: formatPercent(result.earned) })
    ]),
    h('article', { className: 'stat-card' }, [
      h('span', { className: 'stat-card__label', text: 'Current average' }),
      h('strong', { className: 'stat-card__value', text: formatPercent(result.currentAverage) })
    ]),
    h('article', { className: 'stat-card' }, [
      h('span', { className: 'stat-card__label', text: 'Completed weight' }),
      h('strong', { className: 'stat-card__value', text: formatPercent(result.completedWeight) })
    ])
  ])
  return h('div', { className: 'assessment-panel' }, [
    summary,
    renderWeights(subject, categories, assessments, result),
    renderAssessments(subject, categories, assessments, onSaved)
  ])
}

export async function render(container, params) {
  container.replaceChildren(h('div', { className: 'skeleton' }))
  try {
    const subject = await getSubject(params.id)
    const categories = Array.isArray(subject.assessment_categories) ? subject.assessment_categories : []
    const assessments = Array.isArray(subject.assessments) ? subject.assessments : []
    const heading = h('div', { className: 'page-heading' })
    const add = h('button', {
      className: 'button button--primary',
      type: 'button',
      text: '+ Add assessment',
      disabled: categories.length === 0,
      title: categories.length === 0 ? 'Add a category first.' : ''
    })
    heading.append(h('div', {}, [
      h('p', { className: 'eyebrow', text: subject.code }),
      h('h1', { text: subject.name })
    ]), add)

    const tabs = h('div', { className: 'tabs', role: 'tablist', ariaLabel: 'Subject detail' })
    const panel = h('section', { id: 'subject-tab-panel', className: 'tab-panel', role: 'tabpanel', ariaLabelledby: 'subject-tab-assessments' })
    const reloadSubject = () => render(container, params)
    const result = computeSubjectGrade(subject, categories, assessments)
    const assessmentPanel = h('div', { className: 'assessment-tab-content' }, [
      renderCategoryManager(subject, categories, reloadSubject),
      createAssessmentPanel(subject, categories, assessments, reloadSubject, result)
    ])
    let calculatorPanel = null
    let predictorPanel = null
    let finalGradePanel = null
    const tabNames = [
      ['assessments', 'Assessments'],
      ['calculator', 'Calculator'],
      ['predictor', 'Predictor'],
      ['final-grade', 'Final Grade']
    ]
    const tabButtons = new Map()
    function selectTab(key) {
      for (const button of tabs.querySelectorAll('[role="tab"]')) {
        const selected = button.dataset.tab === key
        button.setAttribute('aria-selected', String(selected))
        button.classList.toggle('tab--active', selected)
        button.tabIndex = selected ? 0 : -1
      }
      add.hidden = key !== 'assessments'
      const activeButton = tabs.querySelector(`[data-tab="${key}"]`)
      panel.setAttribute('aria-labelledby', activeButton.id)
      if (key === 'calculator') calculatorPanel ??= createCalculationPanel(subject, result)
      if (key === 'predictor') predictorPanel ??= createPredictorPanel(subject, result)
      if (key === 'final-grade') {
        finalGradePanel ??= createFinalGradePanel(subject, result, reloadSubject)
      }
      const tabPanels = {
        assessments: assessmentPanel,
        calculator: calculatorPanel,
        predictor: predictorPanel,
        'final-grade': finalGradePanel
      }
      panel.replaceChildren(tabPanels[key])
    }
    for (const [key, label] of tabNames) {
      const button = h('button', {
        id: `subject-tab-${key}`,
        className: `tab${key === 'assessments' ? ' tab--active' : ''}`,
        type: 'button',
        role: 'tab',
        ariaSelected: key === 'assessments',
        ariaControls: panel.id,
        tabIndex: key === 'assessments' ? 0 : -1,
        dataTab: key,
        text: label
      })
      tabButtons.set(key, button)
      button.addEventListener('click', () => selectTab(key))
      button.addEventListener('keydown', (event) => {
        const index = tabNames.findIndex(([tabKey]) => tabKey === key)
        const nextIndex = event.key === 'ArrowRight'
          ? (index + 1) % tabNames.length
          : event.key === 'ArrowLeft'
            ? (index + tabNames.length - 1) % tabNames.length
            : event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? tabNames.length - 1
                : -1
        if (nextIndex === -1) return
        event.preventDefault()
        const nextKey = tabNames[nextIndex][0]
        tabButtons.get(nextKey).focus()
        selectTab(nextKey)
      })
      tabs.appendChild(button)
    }

    container.replaceChildren(heading, tabs, panel)
    selectTab('assessments')
    add.addEventListener('click', () => {
      if (categories.length) showAssessmentForm(subject, categories, null, () => render(container, params))
    })
  } catch (error) {
    container.replaceChildren(h('div', { className: 'empty-state' }, [
      h('strong', { text: 'Could not load subject' }),
      h('p', { text: dataErrorMessage(error, 'Try again in a moment.') })
    ]))
  }
}
