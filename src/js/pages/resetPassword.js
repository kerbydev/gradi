import { h } from '../utils/dom.js'
import { updatePassword, authErrorMessage } from '../auth/auth.js'
import { session } from '../state/session.js'
import { validatePassword } from '../utils/validate.js'

export function render(container) {
  const card = h('section', { className: 'auth-card' })
  const form = h('form', { className: 'form auth-form', noValidate: true })
  const password = h('input', { id: 'new-password', name: 'password', type: 'password', autocomplete: 'new-password', minlength: '8', required: true })
  const confirmPassword = h('input', { id: 'confirm-new-password', name: 'confirmPassword', type: 'password', autocomplete: 'new-password', minlength: '8', required: true })
  const error = h('p', { className: 'auth-message auth-message--error', role: 'alert', hidden: true })
  const submit = h('button', { className: 'button button--primary auth-submit', type: 'submit', text: 'Save new password' })
  let submitting = false

  form.append(
    h('div', { className: 'auth-field' }, [h('label', { for: password.id, text: 'New password' }), password]),
    h('div', { className: 'auth-field' }, [h('label', { for: confirmPassword.id, text: 'Confirm new password' }), confirmPassword]),
    error,
    submit
  )
  card.append(
    h('div', { className: 'auth-brand', text: 'Gradi' }),
    h('p', { className: 'eyebrow', text: 'Account recovery' }),
    h('h1', { text: 'Choose a new password' }),
    h('p', { className: 'text-muted', text: 'Use at least 8 characters.' }),
    form
  )
  const showError = (message) => {
    error.textContent = message
    error.hidden = !message
  }
  form.addEventListener('input', () => showError(''))
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (submitting) return
    const validationError = validatePassword(password.value)
      || (password.value !== confirmPassword.value ? 'Passwords do not match.' : '')
    if (validationError) {
      showError(validationError)
      return
    }
    if (!session.recoveryPending) {
      showError('This reset link is invalid or has expired. Request a new reset link.')
      return
    }

    submitting = true
    submit.disabled = true
    submit.textContent = 'Saving…'
    try {
      const { error: authError } = await updatePassword(password.value)
      if (authError) {
        showError(authErrorMessage(authError, 'recovery'))
        return
      }
      session.recoveryPending = false
      sessionStorage.removeItem('gradi:password-recovery')
      window.location.hash = '#/dashboard'
    } catch (authError) {
      showError(authErrorMessage(authError, 'recovery'))
    } finally {
      submitting = false
      submit.disabled = false
      submit.textContent = 'Save new password'
    }
  })
  container.replaceChildren(card)
}
