import { h } from '../utils/dom.js'

export function render(container, params = {}) {
  const heading = h('div', { className: 'page-heading' })
  heading.append(h('div', {}, [
    h('p', { className: 'eyebrow', text: '404' }),
    h('h1', { text: params.invalidParam ? 'Invalid link' : 'Page not found' })
  ]))
  const empty = h('div', { className: 'empty-state' }, [
    h('strong', { text: params.invalidParam ? 'The route parameter is invalid.' : 'This route does not exist.' }),
    h('p', { text: params.path || '' })
  ])
  container.replaceChildren(heading, empty)
}
