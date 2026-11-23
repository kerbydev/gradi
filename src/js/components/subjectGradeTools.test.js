import { describe, expect, it } from 'vitest'
import { requiredTargetMessage } from './subjectGradeTools.js'

describe('required target messages', () => {
  it('uses the requested exact sentence for an achievable target', () => {
    expect(requiredTargetMessage({ status: 'achievable', requiredPercent: 95 }))
      .toBe('You need 95% on your remaining assessments to reach your target.')
  })

  it.each([
    ['achieved', /already reached/],
    ['impossible', /impossible/],
    ['no_remaining', /No assessment weight remains/],
    ['weights_missing', /Configure assessment weights/],
    ['invalid_target', /valid target/]
  ])('has a distinct message for %s', (status, message) => {
    expect(requiredTargetMessage({ status })).toMatch(message)
  })
})
