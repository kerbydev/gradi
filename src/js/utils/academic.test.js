import { describe, expect, it } from 'vitest'
import { sumSubjectUnits } from './academic.js'

describe('sumSubjectUnits', () => {
  it('adds positive numeric units and ignores invalid or non-positive values', () => {
    expect(sumSubjectUnits([
      { units: 3 },
      { units: '1.5' },
      { units: 0 },
      { units: null },
      { units: 'invalid' },
      { units: -1 }
    ])).toBe(4.5)
  })
})
