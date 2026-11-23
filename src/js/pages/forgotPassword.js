import { h } from '../utils/dom.js'
import { resetPassword, authErrorMessage } from '../auth/auth.js'
import { validateEmail } from '../utils/validate.js'

export function render(container) {
  const card = h('section', { className: 'auth-card' })
  const form = h('form', { className: 'form auth-form', noValidate: true })
  const email = h('input', { id: 'recovery-email', name: 'email', type: 'email', autocomplete: 'email', required: true })
  const error = h('p', { className: 'auth-message auth-message--error', role: 'alert', hidden: true })
  const feedback = h('p', { className: 'auth-message auth-message--success', role: 'status', hidden: true })
  const submit = h('button', { className: 'button button--primary auth-submit', type: 'submit', text: 'Send reset link' })
  let submitting = false

  form.append(
    h('div', { className: 'auth-field' }, [h('label', { for: email.id, text: 'Email' }), email]),
    error,
    feedback,
    submit,
    h('p', { className: 'auth-secondary' }, [h('a', { href: '#/login', text: 'Back to sign in' })])
  )
  card.append(
    h('div', { className: 'auth-brand', text: 'Gradi' }),
    h('p', { className: 'eyebrow', text: 'Account recovery' }),
    h('h1', { text: 'Forgot your password?' }),
    h('p', { className: 'text-muted', text: 'Enter your email and we’ll send a link to reset it.' }),
    form
  )
  const showError = (message) => {
    error.textContent = message
    error.hidden = !message
    feedback.hidden = true
  }
  form.addEventListener('input', () => showError(''))
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (submitting) return
    const validationError = validateEmail(email.value)
    if (validationError) {
      showError(validationError)
      return
    }
    submitting = true
    submit.disabled = true
    submit.textContent = 'Sending…'
    try {
      const { error: authError } = await resetPassword(email.value)
      if (authError) {
        showError(authErrorMessage(authError, 'forgot'))
        return
      }
      feedback.textContent = 'If an account exists for that email, a password reset link will be sent.'
      feedback.hidden = false
      form.reset()
    } catch (authError) {
      showError(authErrorMessage(authError, 'forgot'))
    } finally {
      submitting = false
      submit.disabled = false
      submit.textContent = 'Send reset link'
    }
  })
  container.replaceChildren(card)
}
