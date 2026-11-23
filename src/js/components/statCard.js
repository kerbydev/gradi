import { h } from '../utils/dom.js'

export function metricCard(label, value, detail = '') {
  return h('article', { className: 'stat-card' }, [
    h('span', { className: 'stat-card__label', text: label }),
    h('strong', { className: 'stat-card__value', text: value }),
    detail ? h('span', { className: 'text-muted', text: detail }) : null
  ])
}
