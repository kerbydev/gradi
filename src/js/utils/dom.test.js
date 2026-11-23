import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from './dom.js'

describe('h attribute names', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('converts ARIA and data attributes to valid kebab-case names', () => {
    const attributes = {}
    const element = {
      setAttribute(name, value) { attributes[name] = value },
      appendChild() {}
    }
    vi.stubGlobal('document', {
      createElement: () => element,
      createTextNode: text => ({ textContent: text })
    })

    h('div', {
      ariaLabel: 'Details',
      ariaLabelledby: 'heading',
      ariaValueNow: 72,
      dataLabel: 'Code',
      'data-semester-switcher': ''
    })

    expect(attributes).toEqual({
      'aria-label': 'Details',
      'aria-labelledby': 'heading',
      'aria-value-now': '72',
      'data-label': 'Code',
      'data-semester-switcher': ''
    })

  })

  it('rejects raw HTML attributes', () => {
    vi.stubGlobal('document', { createElement: () => ({}) })
    expect(() => h('div', { html: '<b>unsafe</b>' })).toThrow('Raw HTML is not supported')
  })
})
