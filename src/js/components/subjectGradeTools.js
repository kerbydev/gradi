import { h } from '../utils/dom.js'
import { predictFinal, requiredScoreForTarget, computeSubjectGrade } from '../services/gradeCalculator.js'
import { getSemesterContext } from '../api/semestersApi.js'
import { listSubjects } from '../api/subjectsApi.js'
import { formatPercent } from '../utils/format.js'
import { validatePercentage } from '../utils/validate.js'
import { dataErrorMessage } from '../utils/apiError.js'

const WEIGHT_TOLERANCE = 0.0001

function isCompleteWeightTotal(result) {
  return Math.abs(result.totalConfiguredWeight - 100) <= WEIGHT_TOLERANCE
}

function valueCard(label, value, detail = '') {
  const card = h('article', { className: 'stat-card grade-value-card' }, [
    h('span', { className: 'stat-card__label', text: label }),
    h('strong', { className: 'stat-card__value', text: value })
  ])
  if (detail) card.appendChild(h('small', { className: 'text-muted', text: detail }))
  return card
}

function weightBreakdown(result) {
  const completed = Math.min(100, Math.max(0, result.completedWeight))
  const remaining = Math.min(100 - completed, Math.max(0, result.remainingWeight))
  const unconfigured = Math.max(0, 100 - completed - remaining)
  const segments = [
    ['Completed', completed, 'weight-breakdown__completed'],
    ['Remaining', remaining, 'weight-breakdown__remaining'],
    ['Unconfigured', unconfigured, 'weight-breakdown__unconfigured']
  ]
  const bar = h('div', {
    className: 'weight-breakdown',
    role: 'img',
    ariaLabel: `Weight breakdown: ${formatPercent(result.completedWeight)} completed, ${formatPercent(result.remainingWeight)} remaining`
  })
  for (const [, value, className] of segments) {
    const segment = h('span', { className })
    segment.style.width = `${value}%`
    bar.appendChild(segment)
  }
  const legend = h('div', { className: 'weight-breakdown__legend' })
  for (const [label, value, className] of segments) {
    legend.appendChild(h('span', { className: 'weight-breakdown__legend-item' }, [
      h('i', { className: `weight-breakdown__swatch ${className}` }),
      h('span', { text: `${label}: ${formatPercent(value)}` })
    ]))
  }
  return h('section', { className: 'weight-breakdown-section' }, [
    h('h2', { text: 'Weight breakdown' }),
    bar,
    legend
  ])
}

export function createCalculationPanel(subject, result) {
  const projection = result.currentAverage === null
    ? null
    : predictFinal(result, result.currentAverage)
  const configuredWarning = result.weightWarnings.length
    ? h('ul', { className: 'weight-warning-list' }, result.weightWarnings.map(message => h('li', { text: message })))
    : null
  const values = h('div', { className: 'grade-values-grid' }, [
    valueCard('Earned contribution', formatPercent(result.earned), 'Percentage points earned so far'),
    valueCard('Completed weight', formatPercent(result.completedWeight)),
    valueCard('Remaining weight', formatPercent(result.remainingWeight)),
    valueCard('Current average', formatPercent(result.currentAverage)),
    valueCard('Projected percentage', formatPercent(projection?.projectedAverage ?? null), 'Assumes your current average on remaining work')
  ])
  return h('div', { className: 'grade-tool-panel' }, [
    h('p', { className: 'eyebrow', text: `${subject.code} · ${subject.name}` }),
    values,
    weightBreakdown(result),
    ...(configuredWarning ? [configuredWarning] : [])
  ])
}

export function requiredTargetMessage(result) {
  if (result.status === 'achieved') return 'You have already reached your target.'
  if (result.status === 'achievable') {
    const decimals = Number.isInteger(result.requiredPercent) ? 0 : 2
    return `You need ${formatPercent(result.requiredPercent, decimals)} on your remaining assessments to reach your target.`
  }
  if (result.status === 'impossible') return 'This target is impossible with your remaining assessment weights.'
  if (result.status === 'no_remaining') return 'No assessment weight remains to reach this target.'
  if (result.status === 'invalid_target') return 'Enter a valid target between 0 and 100%.'
  return 'Configure assessment weights to total 100% before predicting a target.'
}

export function createPredictorPanel(subject, result) {
  const assessmentNames = new Map((subject.assessments || []).map(item => [item.id, item.name]))
  const categoryNames = new Map((subject.assessment_categories || []).map(item => [item.id, item.name]))
  const remaining = (result.perAssessment || []).filter(item =>
    item.assessmentId != null && item.remainingWeight > WEIGHT_TOLERANCE
  )
  const inputRows = []
  const list = h('div', { className: 'what-if-list' })

  if (!remaining.length) {
    list.appendChild(h('div', { className: 'empty-state empty-state--compact' }, [
      h('strong', { text: 'No remaining assessments' }),
      h('p', { text: 'There are no uncompleted weighted assessments to model.' })
    ]))
  } else {
    for (const item of remaining) {
      const input = h('input', {
        type: 'number',
        min: '0',
        max: '100',
        step: '0.01',
        value: '',
        ariaLabel: `What-if percentage for ${assessmentNames.get(item.assessmentId) || item.name}`
      })
      const name = assessmentNames.get(item.assessmentId) || item.name || 'Assessment'
      const categoryName = categoryNames.get(item.categoryId)
      const row = h('label', { className: 'what-if-row' }, [
        h('span', { className: 'what-if-row__details' }, [
          h('strong', { text: name }),
          h('small', { className: 'text-muted', text: `${categoryName ? `${categoryName} · ` : ''}${formatPercent(item.remainingWeight)} remaining weight` })
        ]),
        input
      ])
      inputRows.push({ item, input })
      list.appendChild(row)
    }
  }

  const reset = h('button', { className: 'button button--secondary', type: 'button', text: 'Reset what-if' })
  const target = h('input', { id: 'predictor-target', type: 'number', min: '0', max: '100', step: '0.01', value: '90' })
  const projected = h('strong', { className: 'grade-tool-result__value' })
  const projectedMessage = h('p', { className: 'text-muted' })
  const targetMessage = h('p', { className: 'predictor-target-message', role: 'status' })

  function update() {
    const scores = {}
    let everyScoreEntered = true
    let representedRemainingWeight = 0
    for (const { item, input } of inputRows) {
      representedRemainingWeight += item.remainingWeight
      if (input.value === '' || validatePercentage(Number(input.value))) {
        everyScoreEntered = false
      } else {
        scores[item.assessmentId] = Number(input.value)
      }
    }
    const allRemainingRepresented = Math.abs(representedRemainingWeight - result.remainingWeight) <= WEIGHT_TOLERANCE
    const canProject = isCompleteWeightTotal(result)
      && everyScoreEntered
      && allRemainingRepresented
    projected.textContent = canProject
      ? formatPercent(predictFinal(result, scores).projectedFinal)
      : '—'
    projectedMessage.textContent = canProject
      ? 'Based on the entered what-if scores.'
      : 'Enter a score for every remaining assessment and configure weights to 100%.'

    const targetValue = target.value === '' ? Number.NaN : Number(target.value)
    const targetResult = requiredScoreForTarget(result, targetValue)
    targetMessage.textContent = requiredTargetMessage(targetResult)
    targetMessage.className = `predictor-target-message predictor-target-message--${targetResult.status}`
  }

  for (const { input } of inputRows) input.addEventListener('input', update)
  target.addEventListener('input', update)
  reset.addEventListener('click', () => {
    for (const { input } of inputRows) input.value = ''
    update()
  })

  const projectedCard = h('article', { className: 'result-box grade-tool-result' }, [
    h('span', { className: 'stat-card__label', text: 'Projected final percentage' }),
    projected,
    projectedMessage
  ])
  const targetForm = h('div', { className: 'target-panel' }, [
    h('label', { for: 'predictor-target', text: 'Target percentage' }),
    target,
    targetMessage
  ])
  update()
  return h('div', { className: 'grade-tool-panel predictor-panel' }, [
    h('p', { className: 'eyebrow', text: `${subject.code} · ${subject.name}` }),
    h('p', { className: 'text-muted', text: 'What-if scores stay in this page and are never saved.' }),
    h('div', { className: 'section-heading' }, [h('h2', { text: 'Remaining assessments' }), reset]),
    list,
    projectedCard,
    targetForm
  ])
}

export function createStandaloneGradeTool(container, type) {
  const title = type === 'predictor' ? 'Grade Predictor' : 'Grade Calculator'
  const header = h('div', { className: 'page-heading' }, [h('h1', { text: title })])
  const picker = h('div', { className: 'subject-picker' })
  const label = h('label', { for: `${type}-subject`, text: 'Subject' })
  const select = h('select', { id: `${type}-subject`, disabled: true })
  picker.append(label, select)
  const content = h('div', { className: 'grade-tool-content' })
  container.replaceChildren(header, picker, content)

  let subjects = []
  let selectedSemesterId = null
  let disposed = false
  let loadId = 0

  function showSelectedSubject() {
    const subject = subjects.find(item => item.id === select.value)
    if (!subject) {
      content.replaceChildren(h('div', { className: 'empty-state' }, [
        h('strong', { text: 'No subjects available' }),
        h('p', { text: 'Add a subject in the selected semester to use this tool.' })
      ]))
      return
    }
    const result = computeSubjectGrade(subject, subject.assessment_categories || [], subject.assessments || [])
    content.replaceChildren(type === 'predictor'
      ? createPredictorPanel(subject, result)
      : createCalculationPanel(subject, result))
  }

  async function loadSubjects() {
    const requestId = ++loadId
    content.replaceChildren(h('div', { className: 'skeleton', ariaLabel: 'Loading subjects' }))
    try {
      const { selected } = await getSemesterContext()
      if (disposed || requestId !== loadId) return
      selectedSemesterId = selected?.id ?? null
      subjects = selectedSemesterId ? await listSubjects(selectedSemesterId) : []
      if (disposed || requestId !== loadId) return
      select.replaceChildren()
      for (const subject of subjects) {
        select.appendChild(h('option', {
          value: subject.id,
          text: `${subject.code} · ${subject.name}`
        }))
      }
      select.disabled = subjects.length === 0
      showSelectedSubject()
    } catch (error) {
      if (disposed || requestId !== loadId) return
      select.disabled = true
      content.replaceChildren(h('div', { className: 'empty-state' }, [
        h('strong', { text: 'Could not load subjects' }),
        h('p', { text: dataErrorMessage(error, 'Try again in a moment.') })
      ]))
    }
  }

  const onSemesterChanged = event => {
    if (event.detail?.semester?.id !== selectedSemesterId) loadSubjects()
  }
  select.addEventListener('change', showSelectedSubject)
  window.addEventListener('semester:changed', onSemesterChanged)
  loadSubjects()
  return () => {
    disposed = true
    window.removeEventListener('semester:changed', onSemesterChanged)
  }
}
