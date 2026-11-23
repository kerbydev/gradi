import { h } from '../utils/dom.js'
import { signIn, authErrorMessage } from '../auth/auth.js'
import { validateEmail, validateRequired } from '../utils/validate.js'

export function render(container) {
  const card = h('section', { className: 'auth-card' })
  const form = h('form', { className: 'form auth-form', noValidate: true })
  const email = h('input', { id: 'login-email', name: 'email', type: 'email', required: true, autocomplete: 'email' })
  const password = h('input', { id: 'login-password', name: 'password', type: 'password', required: true, autocomplete: 'current-password' })
  const error = h('p', { className: 'auth-message auth-message--error', role: 'alert', hidden: true })
  const submit = h('button', { className: 'button button--primary auth-submit', type: 'submit', text: 'Sign in' })
  let submitting = false

  function showError(message) {
    error.textContent = message
    error.hidden = !message
  }

  form.append(
    h('div', { className: 'auth-field' }, [h('label', { for: email.id, text: 'Email' }), email]),
    h('div', { className: 'auth-field' }, [h('label', { for: password.id, text: 'Password' }), password]),
    error,
    submit,
    h('div', { className: 'auth-links' }, [
      h('a', { className: 'auth-link', href: '#/forgot-password', text: 'Forgot password?' }),
      h('p', { className: 'auth-secondary' }, ['New to Gradi? ', h('a', { href: '#/register', text: 'Create an account' })])
    ])
  )
  card.append(
    h('div', { className: 'auth-brand', text: 'Gradi' }),
    h('p', { className: 'eyebrow', text: 'Academic Grade Tracker' }),
    h('h1', { text: 'Welcome back' }),
    h('p', { className: 'text-muted', text: 'Sign in to continue to your academic overview.' }),
    form
  )

  form.addEventListener('input', () => showError(''))
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (submitting) return
    const emailError = validateEmail(email.value)
    const passwordError = validateRequired(password.value, 'Password')
    if (emailError || passwordError) {
      showError(emailError || passwordError)
      return
    }

    submitting = true
    submit.disabled = true
    submit.textContent = 'Signing in…'
    try {
      const { error: authError } = await signIn(email.value, password.value)
      if (authError) {
        showError(authErrorMessage(authError, 'login'))
        return
      }
      window.location.hash = '#/dashboard'
    } catch (authError) {
      showError(authErrorMessage(authError, 'login'))
    } finally {
      submitting = false
      submit.disabled = false
      submit.textContent = 'Sign in'
    }
  })

  container.replaceChildren(card)
}
