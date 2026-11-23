import { h } from '../utils/dom.js'
import { signUp, authErrorMessage } from '../auth/auth.js'
import { validateEmail, validateName, validatePassword } from '../utils/validate.js'

export function render(container) {
  const card = h('section', { className: 'auth-card' })
  const form = h('form', { className: 'form auth-form', noValidate: true })
  const fullName = h('input', { id: 'register-name', name: 'fullName', autocomplete: 'name', required: true })
  const email = h('input', { id: 'register-email', name: 'email', type: 'email', autocomplete: 'email', required: true })
  const password = h('input', { id: 'register-password', name: 'password', type: 'password', autocomplete: 'new-password', minlength: '8', required: true })
  const confirmPassword = h('input', { id: 'register-confirm-password', name: 'confirmPassword', type: 'password', autocomplete: 'new-password', minlength: '8', required: true })
  const error = h('p', { className: 'auth-message auth-message--error', role: 'alert', hidden: true })
  const feedback = h('p', { className: 'auth-message auth-message--success', role: 'status', hidden: true })
  const submit = h('button', { className: 'button button--primary auth-submit', type: 'submit', text: 'Create account' })
  let submitting = false

  function showError(message) {
    error.textContent = message
    error.hidden = !message
    feedback.hidden = true
  }

  function passwordField(id, label, input) {
    const wrap = h('div', { className: 'auth-password-control' })
    const toggle = h('button', { className: 'auth-password-toggle', type: 'button', ariaLabel: `Show ${label.toLowerCase()}`, ariaPressed: 'false', text: 'Show' })
    toggle.addEventListener('click', () => {
      const visible = input.type === 'password'
      input.type = visible ? 'text' : 'password'
      toggle.textContent = visible ? 'Hide' : 'Show'
      toggle.setAttribute('aria-label', `${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`)
      toggle.setAttribute('aria-pressed', String(visible))
      input.focus()
    })
    wrap.append(input, toggle)
    return h('div', { className: 'auth-field' }, [h('label', { for: id, text: label }), wrap])
  }

  form.append(
    h('div', { className: 'auth-field' }, [h('label', { for: fullName.id, text: 'Full name' }), fullName]),
    h('div', { className: 'auth-field' }, [h('label', { for: email.id, text: 'Email' }), email]),
    passwordField(password.id, 'Password', password),
    passwordField(confirmPassword.id, 'Confirm password', confirmPassword),
    error,
    feedback,
    submit,
    h('p', { className: 'auth-secondary' }, ['Already have an account? ', h('a', { href: '#/login', text: 'Sign in' })])
  )
  card.append(
    h('div', { className: 'auth-brand', text: 'Gradi' }),
    h('p', { className: 'eyebrow', text: 'Academic Grade Tracker' }),
    h('h1', { text: 'Create your account' }),
    h('p', { className: 'text-muted', text: 'Start keeping your grades and goals in one place.' }),
    form
  )

  form.addEventListener('input', () => showError(''))
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (submitting) return
    const validationError = validateName(fullName.value)
      || validateEmail(email.value)
      || validatePassword(password.value)
      || (password.value !== confirmPassword.value ? 'Passwords do not match.' : '')
    if (validationError) {
      showError(validationError)
      return
    }

    submitting = true
    submit.disabled = true
    submit.textContent = 'Creating account…'
    try {
      const { data, error: authError } = await signUp(email.value, password.value, fullName.value)
      if (authError) {
        showError(authErrorMessage(authError, 'register'))
        return
      }
      if (data.user?.identities?.length === 0) {
        showError('An account with this email already exists. Try signing in instead.')
        return
      }
      if (data.session) {
        window.location.hash = '#/dashboard'
      } else {
        feedback.textContent = 'Account created. Check your email for a confirmation link, then return here to sign in.'
        feedback.hidden = false
        form.reset()
      }
    } catch (authError) {
      showError(authErrorMessage(authError, 'register'))
    } finally {
      submitting = false
      submit.disabled = false
      submit.textContent = 'Create account'
    }
  })

  container.replaceChildren(card)
}
