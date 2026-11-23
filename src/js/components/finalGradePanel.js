import { h } from '../utils/dom.js'
import { getDefaultGradingProfile, getGradingProfile } from '../api/gradingProfilesApi.js'
import { createGradingRule, updateGradingRule, deleteGradingRule } from '../api/gradingRulesApi.js'
import { saveFinalGrade } from '../api/finalGradesApi.js'
import { convertPercentToGrade } from '../services/gradeCalculator.js'
import { inspectGradingRules, VALID_GRADES, validateNumericGrade } from '../services/gradingRules.js'
import { formatGrade, formatPercent, formatNumber } from '../utils/format.js'
import { validateRequired } from '../utils/validate.js'
import { toast } from './notifications.js'
import { openModal, confirmDialog } from './modal.js'
import { dataErrorMessage } from '../utils/apiError.js'

function sortedRules(rules) {
  return [...rules].sort((left, right) => Number(left.min_percent) - Number(right.min_percent))
}

function showRuleForm(profile, rules, existing, onSaved) {
  const form = h('form', { className: 'form' })
  const minimum = h('input', {
    id: 'rule-minimum',
    type: 'number',
    min: '0',
    max: '100',
    step: '0.01',
    required: true,
    value: existing?.min_percent ?? ''
  })
  const maximum = h('input', {
    id: 'rule-maximum',
    type: 'number',
    min: '0',
    max: '100',
    step: '0.01',
    required: true,
    value: existing?.max_percent ?? ''
  })
  const grade = h('select', { id: 'rule-grade' }, VALID_GRADES.map(value => h('option', {
    value: String(value),
    text: formatGrade(value),
    selected: Number(existing?.grade) === value
  })))
  const error = h('p', { className: 'field-error', ariaLive: 'polite' })
  const submit = h('button', { className: 'button button--primary', type: 'submit', text: existing ? 'Save rule' : 'Add rule' })
  form.append(
    h('label', { for: 'rule-minimum', text: 'Minimum percentage' }), minimum,
    h('label', { for: 'rule-maximum', text: 'Maximum percentage' }), maximum,
    h('label', { for: 'rule-grade', text: 'Numeric grade' }), grade,
    error, submit
  )

  const close = openModal(existing ? 'Edit grading rule' : 'Add grading rule', form)
  form.addEventListener('submit', async event => {
    event.preventDefault()
    error.textContent = ''
    const min = minimum.value === '' ? Number.NaN : Number(minimum.value)
    const max = maximum.value === '' ? Number.NaN : Number(maximum.value)
    const candidate = {
      min_percent: min,
      max_percent: max,
      grade: Number(grade.value)
    }
    const remainingRules = rules.filter(rule => rule.id !== existing?.id)
    const validation = inspectGradingRules([...remainingRules, candidate])
    if (validateRequired(minimum.value, 'Minimum percentage')) {
      error.textContent = 'Minimum percentage is required.'
      return
    }
    if (validateRequired(maximum.value, 'Maximum percentage')) {
      error.textContent = 'Maximum percentage is required.'
      return
    }
    if (validation.errors.length) {
      error.textContent = validation.errors[0]
      return
    }
    if (validation.overlaps.length) {
      error.textContent = validation.overlaps[0]
      return
    }

    submit.disabled = true
    try {
      const values = {
        grading_profile_id: profile.id,
        min_percent: min,
        max_percent: max,
        grade: candidate.grade
      }
      if (existing) await updateGradingRule(existing.id, values)
      else await createGradingRule(values)
      toast(validation.gaps.length ? 'Rule saved; uncovered percentage ranges remain.' : 'Grading rule saved.')
      close()
      await onSaved()
    } catch (saveError) {
      error.textContent = dataErrorMessage(saveError, 'Could not save the grading rule.')
    } finally {
      submit.disabled = false
    }
  })
}

function renderRuleTable(profile, rules, onSaved) {
  const section = h('section', { className: 'card grading-rules' })
  const heading = h('div', { className: 'section-heading' })
  const add = h('button', {
    className: 'button button--secondary',
    type: 'button',
    text: '+ Add rule',
    disabled: !profile
  })
  heading.append(
    h('div', {}, [
      h('h2', { text: 'Grading rules' }),
      h('p', { className: 'text-muted', text: profile?.name ? `Profile: ${profile.name}` : 'No grading profile is available.' })
    ]),
    add
  )
  section.appendChild(heading)
  add.addEventListener('click', () => {
    if (profile) showRuleForm(profile, rules, null, onSaved)
  })

  if (!rules.length) {
    section.appendChild(h('div', { className: 'empty-state empty-state--compact' }, [
      h('strong', { text: 'No grading rules configured' }),
      h('p', { text: 'Add a rule to convert a percentage into a numeric grade.' })
    ]))
  } else {
    const table = h('table', { className: 'table grading-rules-table' })
    table.appendChild(h('thead', {}, [
      h('tr', {}, ['Minimum %', 'Maximum %', 'Grade', 'Actions'].map(label => h('th', { scope: 'col', text: label })))
    ]))
    const body = h('tbody')
    for (const rule of rules) {
      const edit = h('button', { className: 'button button--secondary', type: 'button', text: 'Edit', ariaLabel: `Edit rule starting at ${rule.min_percent}%` })
      edit.addEventListener('click', () => showRuleForm(profile, rules, rule, onSaved))
      const remove = h('button', { className: 'button button--danger', type: 'button', text: 'Delete', ariaLabel: `Delete rule starting at ${rule.min_percent}%` })
      remove.addEventListener('click', async () => {
        const confirmed = await confirmDialog({
          title: 'Delete grading rule?',
          message: `Remove the rule covering ${rule.min_percent}% to ${rule.max_percent}%?`,
          confirmText: 'Delete rule',
          danger: true
        })
        if (!confirmed) return
        remove.disabled = true
        try {
          await deleteGradingRule(rule.id)
          toast('Grading rule deleted.')
          await onSaved()
        } catch (error) {
          toast(dataErrorMessage(error, 'Could not delete the grading rule.'), 'error')
        } finally {
          remove.disabled = false
        }
      })
      const row = h('tr')
      for (const [label, value] of [
        ['Minimum %', formatNumber(Number(rule.min_percent), 2)],
        ['Maximum %', formatNumber(Number(rule.max_percent), 2)],
        ['Grade', formatGrade(Number(rule.grade))],
        ['Actions', h('div', { className: 'subject-actions' }, [edit, remove])]
      ]) row.appendChild(h('td', { dataLabel: label }, [typeof value === 'string' ? h('span', { text: value }) : value]))
      body.appendChild(row)
    }
    table.appendChild(body)
    section.appendChild(h('div', { className: 'table-wrap grading-rules-table-wrap' }, [table]))
  }

  const validation = inspectGradingRules(rules)
  if (validation.errors.length || validation.overlaps.length) {
    const errors = h('ul', { className: 'rule-validation rule-validation--error' })
    for (const message of [...validation.errors, ...validation.overlaps]) errors.appendChild(h('li', { text: message }))
    section.appendChild(errors)
  }
  if (validation.gaps.length) {
    section.appendChild(h('p', {
      className: 'rule-validation rule-validation--warning',
      text: `Uncovered ranges: ${validation.gaps.join(', ')}. Percentages in these ranges have no matching rule.`
    }))
  }
  return section
}

export function createGradingRulesEditor(profile, onSaved) {
  if (!profile) {
    return h('section', { className: 'card grading-rules' }, [
      h('h2', { text: 'Grading rules' }),
      h('p', { className: 'text-muted', text: 'No grading profile is available.' })
    ])
  }
  const rules = sortedRules(Array.isArray(profile.grading_rules) ? profile.grading_rules : [])
  return renderRuleTable(profile, rules, onSaved)
}

function finalGradeValueText(finalGrade) {
  if (!finalGrade) return 'No final grade saved.'
  const grade = finalGrade.status
    ? finalGrade.status
    : formatGrade(Number(finalGrade.grade_value))
  const source = finalGrade.source === 'computed' ? 'Computed' : 'Manual'
  return `Saved final grade: ${grade} · Source: ${source}`
}

function renderGradeEntry(subject, result, profile, rules, finalGrade, onSaved) {
  const form = h('form', { className: 'card form final-grade-form' })
  const mode = h('select', { id: 'final-grade-mode' }, [
    h('option', { value: 'computed', text: 'Convert current percentage using grading rules', selected: !finalGrade || finalGrade.source === 'computed' }),
    h('option', { value: 'manual', text: 'Enter a numeric grade manually', selected: finalGrade?.source === 'manual' && finalGrade.status == null }),
    h('option', { value: 'status', text: 'Record a non-numeric status', selected: finalGrade?.status != null })
  ])
  const currentPercent = result.currentAverage
  const conversion = currentPercent === null
    ? { grade: null, matchedRule: null }
    : convertPercentToGrade(currentPercent, rules)
  const computedSection = h('div', { className: 'final-grade-mode-panel' }, [
    h('p', { className: 'text-muted', text: `Current percentage: ${formatPercent(currentPercent)}` }),
    h('p', {
      className: conversion.grade == null ? 'field-error' : 'final-grade-preview',
      text: conversion.grade == null
        ? currentPercent === null ? 'No completed percentage is available to convert.' : 'No rule matched this percentage.'
        : `Computed grade: ${formatGrade(conversion.grade)}`
    })
  ])
  const numericGrade = h('input', {
    id: 'manual-grade',
    type: 'number',
    min: '1',
    max: '5',
    step: '0.01',
    value: finalGrade?.source === 'manual' && finalGrade.status == null ? finalGrade.grade_value ?? '' : ''
  })
  const numericError = h('p', { className: 'field-error', ariaLive: 'polite' })
  const numericSection = h('div', { className: 'final-grade-mode-panel form' }, [
    h('label', { for: 'manual-grade', text: 'Numeric grade (1.00–5.00)' }),
    numericGrade,
    h('p', { className: 'text-muted', text: 'Allowed grades match your Supabase grade scale.' }),
    numericError
  ])
  const status = h('select', { id: 'final-grade-status' }, [
    ['INC', 'Incomplete (INC)'],
    ['IP', 'In progress (IP)'],
    ['DR', 'Dropped (DR)'],
    ['WDRW', 'Withdrawn (WDRW)']
  ].map(([value, label]) => h('option', {
    value,
    text: label,
    selected: finalGrade?.status === value
  })))
  const statusSection = h('div', { className: 'final-grade-mode-panel form' }, [
    h('label', { for: 'final-grade-status', text: 'Status' }),
    status
  ])
  const error = h('p', { className: 'field-error', ariaLive: 'polite' })
  const submit = h('button', { className: 'button button--primary', type: 'submit', text: 'Save final grade' })
  const savedValue = h('p', { className: 'saved-final-grade', role: 'status', text: finalGradeValueText(finalGrade) })
  form.append(
    h('label', { for: 'final-grade-mode', text: 'Final grade method' }), mode,
    computedSection, numericSection, statusSection, error, submit, savedValue
  )

  function updateMode() {
    const selected = mode.value
    computedSection.hidden = selected !== 'computed'
    numericSection.hidden = selected !== 'manual'
    statusSection.hidden = selected !== 'status'
    numericGrade.disabled = selected !== 'manual'
    status.disabled = selected !== 'status'
    submit.disabled = selected === 'computed' && conversion.grade == null
  }
  mode.addEventListener('change', updateMode)
  updateMode()

  form.addEventListener('submit', async event => {
    event.preventDefault()
    error.textContent = ''
    numericError.textContent = ''
    let values
    if (mode.value === 'computed') {
      if (!profile) {
        error.textContent = 'No grading profile is available for computed grades.'
        return
      }
      if (conversion.grade == null || currentPercent === null) {
        error.textContent = 'No rule matched this percentage.'
        return
      }
      values = {
        grade_value: conversion.grade,
        status: null,
        source: 'computed',
        percent_basis: currentPercent
      }
    } else if (mode.value === 'manual') {
      const validation = validateNumericGrade(numericGrade.value === '' ? null : Number(numericGrade.value))
      if (validation) {
        numericError.textContent = validation
        return
      }
      values = {
        grade_value: Number(numericGrade.value),
        status: null,
        source: 'manual',
        percent_basis: null
      }
    } else {
      values = {
        grade_value: null,
        status: status.value,
        source: 'manual',
        percent_basis: null
      }
    }

    submit.disabled = true
    try {
      await saveFinalGrade(subject.id, values)
      toast('Final grade saved.')
      savedValue.textContent = finalGradeValueText(values)
      await onSaved()
    } catch (saveError) {
      error.textContent = dataErrorMessage(saveError, 'Could not save the final grade.')
    } finally {
      updateMode()
    }
  })
  return form
}

function renderFinalGradePanel(subject, result, profile, onSaved) {
  const rules = sortedRules(Array.isArray(profile?.grading_rules) ? profile.grading_rules : [])
  const finalRows = Array.isArray(subject.final_grades) ? subject.final_grades : [subject.final_grades]
  const finalGrade = finalRows.find(Boolean) ?? null
  const entry = renderGradeEntry(subject, result, profile, rules, finalGrade, onSaved)
  const rulesPanel = renderRuleTable(profile, rules, onSaved)
  return h('div', { className: 'final-grade-panel' }, [
    entry,
    rulesPanel
  ])
}

export function createFinalGradePanel(subject, result, onSaved) {
  const panel = h('div', { className: 'final-grade-panel' }, [h('div', { className: 'skeleton', ariaLabel: 'Loading grading rules' })])
  async function load() {
    try {
      const profile = subject.grading_profile_id
        ? await getGradingProfile(subject.grading_profile_id)
        : await getDefaultGradingProfile()
      panel.replaceChildren(renderFinalGradePanel(subject, result, profile, onSaved))
    } catch (error) {
      panel.replaceChildren(h('div', { className: 'empty-state' }, [
        h('strong', { text: 'Could not load grading rules' }),
        h('p', { text: dataErrorMessage(error, 'Try again in a moment.') })
      ]))
    }
  }
  load()
  return panel
}
