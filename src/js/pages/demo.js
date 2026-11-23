import { h } from '../utils/dom.js'
import { openModal, confirmDialog } from '../components/modal.js'
import { toast } from '../components/notifications.js'

export function render(container) {
  const heading = h('div', { className: 'page-heading' })
  heading.append(h('div', {}, [
    h('p', { className: 'eyebrow', text: 'Foundation' }),
    h('h1', { text: 'Component demo' }),
    h('p', { className: 'text-muted', text: 'Static component previews only; no academic account data is read or saved on this page.' })
  ]))

  const actions = h('div', { className: 'button-row' })
  const modalButton = h('button', { className: 'button button--primary', type: 'button', text: 'Open modal' })
  const toastButton = h('button', { className: 'button button--secondary', type: 'button', text: 'Show toast' })
  const confirmButton = h('button', { className: 'button button--danger', type: 'button', text: 'Confirm action' })
  actions.append(modalButton, toastButton, confirmButton)

  modalButton.addEventListener('click', () => {
    const content = h('div', {}, [
      h('p', { text: 'This modal includes Escape-to-close and keyboard focus trapping.' }),
      h('button', { className: 'button button--primary', type: 'button', text: 'Got it' })
    ])
    const close = openModal('Demo modal', content)
    content.querySelector('button').addEventListener('click', close)
  })
  toastButton.addEventListener('click', () => toast('This is a working toast notification.'))
  confirmButton.addEventListener('click', async () => {
    const confirmed = await confirmDialog({
      title: 'Delete demo item?',
      message: 'This demonstrates the shared confirmation dialog.',
      confirmText: 'Delete',
      cancelText: 'Keep',
      danger: true
    })
    toast(confirmed ? 'Confirmed.' : 'Cancelled.', confirmed ? 'success' : 'info')
  })

  const badges = h('div', { className: 'badge-row' }, [
    h('span', { className: 'badge badge--success', text: 'Completed' }),
    h('span', { className: 'badge badge--warning', text: 'In progress' }),
    h('span', { className: 'badge badge--danger', text: 'Overdue' })
  ])

  const cards = h('div', { className: 'stats-grid' }, [
    h('article', { className: 'stat-card' }, [h('span', { className: 'stat-card__label', text: 'Metric preview' }), h('strong', { className: 'stat-card__value', text: '—' })]),
    h('article', { className: 'stat-card' }, [h('span', { className: 'stat-card__label', text: 'Count preview' }), h('strong', { className: 'stat-card__value', text: '—' })]),
    h('article', { className: 'stat-card' }, [h('span', { className: 'stat-card__label', text: 'Status preview' }), h('strong', { className: 'stat-card__value', text: 'Example' })])
  ])

  const form = h('form', { className: 'card form' })
  form.append(
    h('h2', { text: 'Inputs' }),
    h('label', { for: 'demo-name', text: 'Text input' }),
    h('input', { id: 'demo-name', placeholder: 'Enter a value' }),
    h('label', { for: 'demo-select', text: 'Select' }),
    h('select', { id: 'demo-select' }, [
      h('option', { value: 'active', text: 'Active' }),
      h('option', { value: 'planned', text: 'Planned' })
    ]),
    h('p', { className: 'field-error', text: '' })
  )

  const progress = h('div', { className: 'progress-section' }, [
    h('div', { className: 'progress__label' }, [h('span', { text: 'Progress preview (static)' }), h('strong', { text: '50%' })]),
    h('div', { className: 'progress', role: 'progressbar', ariaLabel: 'Static progress component preview', ariaValueNow: '50', ariaValueMin: '0', ariaValueMax: '100' }, [
      h('span', { className: 'progress__fill', style: 'width:50%' })
    ])
  ])

  const tabs = h('div', { className: 'tabs', role: 'tablist', ariaLabel: 'Component examples' })
  const tabOne = h('button', { id: 'demo-tab-overview', className: 'tab tab--active', type: 'button', role: 'tab', ariaSelected: 'true', ariaControls: 'demo-tab-panel', tabIndex: 0, text: 'Overview' })
  const tabTwo = h('button', { id: 'demo-tab-details', className: 'tab', type: 'button', role: 'tab', ariaSelected: 'false', ariaControls: 'demo-tab-panel', tabIndex: -1, text: 'Details' })
  tabs.append(tabOne, tabTwo)
  const tabPanel = h('div', { id: 'demo-tab-panel', className: 'card', role: 'tabpanel', ariaLabelledby: tabOne.id })
  const tabContent = [
    'Overview component preview.',
    'Details component preview.'
  ]
  const demoTabs = [tabOne, tabTwo]
  function selectDemoTab(index, focus = false) {
    demoTabs.forEach((tab, itemIndex) => {
      const selected = itemIndex === index
      tab.classList.toggle('tab--active', selected)
      tab.setAttribute('aria-selected', String(selected))
      tab.tabIndex = selected ? 0 : -1
    })
    tabPanel.setAttribute('aria-labelledby', demoTabs[index].id)
    tabPanel.replaceChildren(h('p', { text: tabContent[index] }))
    if (focus) demoTabs[index].focus()
  }
  demoTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectDemoTab(index))
    tab.addEventListener('keydown', (event) => {
      const next = event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? (index + 1) % demoTabs.length
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? (index + demoTabs.length - 1) % demoTabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? demoTabs.length - 1
              : -1
      if (next === -1) return
      event.preventDefault()
      selectDemoTab(next, true)
    })
  })
  selectDemoTab(0)

  const table = h('div', { className: 'table-wrap' })
  table.append(h('table', { className: 'table' }, [
    h('thead', {}, [h('tr', {}, [h('th', { text: 'Subject' }), h('th', { text: 'Units' }), h('th', { text: 'Status' })])]),
    h('tbody', {}, [
    h('tr', {}, [h('td', { text: 'Example row A' }), h('td', { text: '—' }), h('td', {}, [h('span', { className: 'badge badge--success', text: 'Completed' })])]),
    h('tr', {}, [h('td', { text: 'Example row B' }), h('td', { text: '—' }), h('td', {}, [h('span', { className: 'badge badge--warning', text: 'In progress' })])])
    ])
  ]))

  const skeleton = h('div', { className: 'demo-grid' }, [
    h('div', { className: 'skeleton skeleton--compact' }),
    h('div', { className: 'empty-state' }, [h('strong', { text: 'Empty state' }), h('p', { text: 'Nothing to show yet.' })])
  ])

  container.replaceChildren(
    heading,
    h('section', { className: 'demo-section' }, [h('h2', { text: 'Actions and badges' }), actions, badges]),
    h('section', { className: 'demo-section' }, [h('h2', { text: 'Cards' }), cards]),
    h('section', { className: 'demo-section' }, [form]),
    h('section', { className: 'demo-section' }, [h('h2', { text: 'Progress' }), progress]),
    h('section', { className: 'demo-section' }, [h('h2', { text: 'Tabs' }), tabs, tabPanel]),
    h('section', { className: 'demo-section' }, [h('h2', { text: 'Table' }), table]),
    h('section', { className: 'demo-section' }, [h('h2', { text: 'Loading and empty states' }), skeleton])
  )

}
