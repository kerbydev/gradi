import { supabase } from '../supabase.js'
import { session } from '../state/session.js'

export async function getSession() {
  if (!supabase) return null
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  session.user = data.session?.user ?? null
  return session.user
}

export function watchAuthState(onRecovery) {
  if (!supabase) return () => {}

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, authSession) => {
    session.user = authSession?.user ?? null
    if (event === 'PASSWORD_RECOVERY') {
      session.recoveryPending = true
      sessionStorage.setItem('gradi:password-recovery', 'true')
      onRecovery?.()
    } else if (event === 'SIGNED_IN' && !window.location.hash.startsWith('#/')) {
      window.location.hash = authSession ? '#/dashboard' : '#/login'
    } else if (event === 'SIGNED_OUT') {
      session.recoveryPending = false
      sessionStorage.removeItem('gradi:password-recovery')
    }
  })

  return () => subscription.unsubscribe()
}

export async function signIn(email, password) {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase.auth.signInWithPassword({ email: email.trim(), password })
}

export async function signUp(email, password, fullName) {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { full_name: fullName.trim() },
      emailRedirectTo: `${window.location.origin}${window.location.pathname}`
    }
  })
}

export async function resetPassword(email) {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}${window.location.pathname}`
  })
}

export async function updatePassword(password) {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase.auth.updateUser({ password })
}

export async function signOut() {
  if (supabase) {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }
  session.clear()
  sessionStorage.removeItem('gradi:password-recovery')
  window.location.hash = '#/login'
}

export function authErrorMessage(error, context = 'general') {
  const code = String(error?.code || '').toLowerCase()
  const message = String(error?.message || '').toLowerCase()
  const status = Number(error?.status)

  if (code.includes('weak_password') || message.includes('password should be')) {
    return 'Choose a stronger password with at least 8 characters.'
  }
  if (code.includes('user_already_exists') || message.includes('already registered') || message.includes('already been registered')) {
    return 'An account with this email already exists. Try signing in instead.'
  }
  if (code.includes('email_not_confirmed') || message.includes('email not confirmed')) {
    return 'Please confirm your email using the link we sent before signing in.'
  }
  if (code.includes('invalid_credentials') || message.includes('invalid login credentials')) {
    return 'Email or password is incorrect. Check your details and try again.'
  }
  if (code.includes('signup_disabled') || message.includes('signups not allowed')) {
    return 'New account registration is currently unavailable.'
  }
  if (message.includes('supabase is not configured')) {
    return 'Authentication is not configured. Add the Supabase URL and publishable key to the app environment.'
  }
  if (status === 429) return 'Too many attempts. Please wait a moment and try again.'
  if (context === 'register') return 'We could not create your account. Check your details and try again.'
  if (context === 'forgot') return 'We could not send a reset link right now. Please try again later.'
  if (context === 'recovery') return 'We could not update your password. Request a new reset link and try again.'
  if (context === 'logout') return 'We could not sign you out. Please try again.'
  return 'We could not sign you in. Please try again.'
}
