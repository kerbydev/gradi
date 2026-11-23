import { h } from '../utils/dom.js'

export function toast(message, type = 'success') {
  const region = document.querySelector('[data-toast-region]') || (() => {
    const el = h('div', { className: 'toast-region', role: 'status', ariaLive: 'polite' })
    el.dataset.toastRegion = ''
    document.body.appendChild(el)
    return el
  })()
  const item = h('div', { className: `toast toast--${type}`, role: type === 'error' ? 'alert' : 'status' }, [
    h('span', { text: message })
  ])
  region.appendChild(item)
  setTimeout(() => item.remove(), 4500)
}

export function showLoading(container) {
  container.replaceChildren(h('div', { className: 'skeleton', ariaLabel: 'Loading' }))
}
