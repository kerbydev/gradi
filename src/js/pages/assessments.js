import { h } from '../utils/dom.js'
export async function render(container) {
  container.replaceChildren(
    h('h1', { text: 'Assessments' }),
    h('div', { className: 'empty-state' }, [
      h('strong', { text: 'Open a subject' }),
      h('p', { text: 'Manage assessments from its subject detail page.' }),
      h('a', { className: 'button button--primary', href: '#/subjects', text: 'Choose a subject' })
    ])
  )
}
