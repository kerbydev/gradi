import { h } from '../utils/dom.js'
import { authErrorMessage, signOut } from '../auth/auth.js'
import { toast } from './notifications.js'
import { getSemesterContext } from '../api/semestersApi.js'
import { updateProfile } from '../api/profileApi.js'
import { session } from '../state/session.js'

function setDrawerOpen(open, trigger = null, restoreFocus = true) {
  const nav = document.querySelector('.sidebar')
  if (!nav) return
  const backdrop = document.querySelector('.sidebar-backdrop')
  nav.classList.toggle('sidebar--open', open)
  backdrop?.classList.toggle('sidebar-backdrop--visible', open)
  const hidden = !open && window.innerWidth <= 1023
  nav.inert = hidden
  if (hidden) nav.setAttribute('aria-hidden', 'true')
  else nav.removeAttribute('aria-hidden')
  const triggers = document.querySelectorAll('.top-bar__menu, .mobile-header .icon-button')
  triggers.forEach(button => button.setAttribute('aria-expanded', String(open)))
  if (open) nav.querySelector('a[href], button:not(:disabled), select:not(:disabled)')?.focus()
  else if (restoreFocus) (trigger || triggers[0])?.focus()
}

function installDrawerKeyboardHandler() {
  if (installDrawerKeyboardHandler.installed) return
  installDrawerKeyboardHandler.installed = true
  document.addEventListener('keydown', (event) => {
    const nav = document.querySelector('.sidebar')
    if (!nav?.classList.contains('sidebar--open') || window.innerWidth > 1023) return
    if (event.key === 'Escape') {
      event.preventDefault()
      setDrawerOpen(false)
      return
    }
    if (event.key !== 'Tab') return
    const focusable = Array.from(nav.querySelectorAll('a[href], button:not(:disabled), select:not(:disabled)'))
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && (document.activeElement === first || !nav.contains(document.activeElement))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (document.activeElement === last || !nav.contains(document.activeElement))) {
      event.preventDefault()
      first.focus()
    }
  })
}

export function closeMobileDrawer(restoreFocus = true) {
  setDrawerOpen(false, null, restoreFocus)
}

export function sidebar() {
  const nav = h('aside', { className: 'sidebar' })
  nav.id = 'primary-sidebar'
  nav.setAttribute('aria-label', 'Sidebar')
  const updateDrawerVisibility = () => {
    const hidden = window.innerWidth <= 1023 && !nav.classList.contains('sidebar--open')
    nav.inert = hidden
    if (hidden) nav.setAttribute('aria-hidden', 'true')
    else nav.removeAttribute('aria-hidden')
  }
  updateDrawerVisibility()
  window.addEventListener('resize', updateDrawerVisibility)
  const brand = h('a', { className: 'sidebar__brand', href: '#/dashboard', text: 'GradeTrack' })
  const links = [
    ['Dashboard', '#/dashboard'], ['Semesters', '#/semesters'], ['Subjects', '#/subjects'],
    ['Assessments', '#/assessments'], ['Grade Calculator', '#/grade-calculator'],
    ['Predictor', '#/grade-predictor'], ['GWA', '#/gwa'],
    ['History', '#/history'], ['Analytics', '#/analytics'], ['Demo', '#/demo'], ['Settings', '#/settings']
  ]
  const list = h('nav', { className: 'sidebar__nav', ariaLabel: 'Primary navigation' })
  for (const [label, href] of links) {
    const link = h('a', { className: 'sidebar__link', href, text: label })
    link.addEventListener('click', () => {
      if (nav.classList.contains('sidebar--open')) setDrawerOpen(false)
    })
    list.appendChild(link)
  }
  const signOutButton = h('button', { className: 'button button--ghost', type: 'button', text: 'Sign out' })
  let signingOut = false
  signOutButton.addEventListener('click', async () => {
    if (signingOut) return
    signingOut = true
    signOutButton.disabled = true
    signOutButton.textContent = 'Signing out…'
    try {
      await signOut()
    } catch (error) {
      toast(authErrorMessage(error, 'logout'), 'error')
    } finally {
      signingOut = false
      signOutButton.disabled = false
      signOutButton.textContent = 'Sign out'
    }
  })
  nav.append(brand, list, signOutButton)
  return nav
}

export function mobileHeader() {
  installDrawerKeyboardHandler()
  const header = h('header', { className: 'mobile-header' })
  header.append(
    h('button', { className: 'icon-button', type: 'button', ariaLabel: 'Open menu', ariaControls: 'primary-sidebar', ariaExpanded: 'false', text: '☰' }),
    h('strong', { text: 'GradeTrack' })
  )
  header.firstElementChild.addEventListener('click', (event) => {
    const sidebarElement = document.querySelector('.sidebar')
    setDrawerOpen(!sidebarElement?.classList.contains('sidebar--open'), event.currentTarget)
  })
  return header
}

export function topBar(title = 'GradeTrack') {
  installDrawerKeyboardHandler()
  const header = h('header', { className: 'top-bar' })
  const select = h('select', { 'data-semester-switcher': '', ariaLabel: 'Selected semester', disabled: true })
  header.append(
    h('div', { className: 'top-bar__title' }, [h('strong', { text: title })]),
    h('label', { className: 'semester-switcher' }, [
      h('span', { text: 'Semester' }),
      select
    ])
  )
  const menu = h('button', { className: 'icon-button top-bar__menu', type: 'button', ariaLabel: 'Open menu', ariaControls: 'primary-sidebar', ariaExpanded: 'false', text: '☰' })
  header.prepend(menu)
  menu.addEventListener('click', (event) => {
    const sidebarElement = document.querySelector('.sidebar')
    setDrawerOpen(!sidebarElement?.classList.contains('sidebar--open'), event.currentTarget)
  })
  let semesters = []
  select.addEventListener('change', async () => {
    const selected = semesters.find(item => item.id === select.value)
    if (!selected) return
    select.disabled = true
    try {
      session.profile = await updateProfile({ active_semester_id: selected.id })
      session.activeSemester = selected
      window.dispatchEvent(new CustomEvent('semester:changed', { detail: { semester: selected } }))
    } catch {
      toast('Could not save the selected semester.', 'error')
      select.value = session.activeSemester?.id || ''
    } finally {
      select.disabled = false
    }
  })

  header.refreshSemesterSwitcher = async () => {
    const previousId = session.activeSemester?.id
    try {
      const context = await getSemesterContext()
      semesters = context.semesters
      select.replaceChildren()
      if (!semesters.length) {
        select.appendChild(h('option', { value: '', text: 'No semesters yet' }))
        select.disabled = true
        return
      }
      for (const semester of semesters) {
        select.appendChild(h('option', {
          value: semester.id,
          text: `${semester.academic_year} · ${semester.term}${semester.status === 'active' ? ' · Active' : ' · Archived'}`
        }))
      }
      select.value = context.selected.id
      select.disabled = false
      if (previousId !== context.selected.id) {
        window.dispatchEvent(new CustomEvent('semester:changed', { detail: { semester: context.selected } }))
      }
    } catch {
      select.disabled = true
      toast('Could not load semesters.', 'error')
    }
  }
  window.addEventListener('semesters:changed', header.refreshSemesterSwitcher)
  return header
}
