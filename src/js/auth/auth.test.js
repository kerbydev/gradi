import { describe, expect, it } from 'vitest'
import { authErrorMessage } from './auth.js'
import { validatePassword } from '../utils/validate.js'

describe('auth error messages', () => {
  it('maps duplicate and confirmation errors to clear user messages', () => {
    expect(authErrorMessage({ message: 'User already registered' }, 'register'))
      .toMatch(/already exists/i)
    expect(authErrorMessage({ code: 'email_not_confirmed' }, 'login'))
      .toMatch(/confirm your email/i)
  })

  it('does not expose raw provider error messages', () => {
    expect(authErrorMessage({ message: 'sensitive backend details' }, 'register'))
      .toBe('We could not create your account. Check your details and try again.')
  })
})

describe('registration password validation', () => {
  it('requires at least eight characters', () => {
    expect(validatePassword('short')).toMatch(/at least 8 characters/i)
    expect(validatePassword('eightchar')).toBe('')
  })
})
