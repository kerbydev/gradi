import { h } from '../utils/dom.js'

export function openModal(title, content, onClose) {
  const backdrop = h('div', { className: 'modal-backdrop', role: 'presentation' })
  const modal = h('div', { className: 'modal', role: 'dialog', ariaModal: 'true', ariaLabel: title })
  const header = h('div', { className: 'modal__header' })
  const close = h('button', { className: 'icon-button', type: 'button', ariaLabel: 'Close dialog', text: '×' })
  header.append(h('h2', { text: title }), close)
  modal.append(header, content)
  backdrop.appendChild(modal)
  document.body.appendChild(backdrop)
  const previouslyFocused = document.activeElement
  const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

  const closeModal = () => {
    document.removeEventListener('keydown', trapFocus)
    backdrop.remove()
    onClose?.()
    if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
  }
  function trapFocus(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeModal()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = Array.from(modal.querySelectorAll(focusableSelector))
    if (!focusable.length) {
      event.preventDefault()
      modal.focus()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }
  close.addEventListener('click', closeModal)
  backdrop.addEventListener('click', event => { if (event.target === backdrop) closeModal() })
  document.addEventListener('keydown', trapFocus)
  modal.tabIndex = -1
  close.focus()
  return closeModal
}

export function confirmDialog({ title = 'Confirm action', message = 'Are you sure?', confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = {}) {
  return new Promise(resolve => {
    const content = h('div', { className: 'confirm-dialog' })
    content.append(h('p', { text: message }))
    const actions = h('div', { className: 'modal__actions' })
    const cancel = h('button', { className: 'button button--secondary', type: 'button', text: cancelText })
    const confirm = h('button', { className: `button ${danger ? 'button--danger' : 'button--primary'}`, type: 'button', text: confirmText })
    actions.append(cancel, confirm)
    content.append(actions)
    let settled = false
    const close = openModal(title, content, () => {
      if (!settled) resolve(false)
    })
    cancel.addEventListener('click', () => {
      settled = true
      close()
      resolve(false)
    })
    confirm.addEventListener('click', () => {
      settled = true
      close()
      resolve(true)
    })
  })
}
