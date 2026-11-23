export function h(tag, attributes = {}, children = []) {
  const element = document.createElement(tag)
  for (const [key, value] of Object.entries(attributes)) {
    if (value == null) continue
    if (key === 'className') element.className = value
    else if (key === 'text') element.textContent = value
    else if (key === 'html') throw new TypeError('Raw HTML is not supported by h().')
    else if (key.startsWith('aria') || key.startsWith('data')) {
      const prefix = key.startsWith('aria') ? 'aria' : 'data'
      const suffix = key.slice(prefix.length)
        .replace(/^-+/, '')
        .replace(/([A-Z])/g, '-$1')
        .replace(/^-+/, '')
        .toLowerCase()
      element.setAttribute(`${prefix}-${suffix}`, String(value))
    }
    else if (key in element) element[key] = value
    else element.setAttribute(key, String(value))
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child == null) continue
    element.appendChild(typeof child === 'string' ? document.createTextNode(child) : child)
  }
  return element
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[char])
}
