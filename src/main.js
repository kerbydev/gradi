import './css/tokens.css'
import './css/base.css'
import './css/layout.css'
import './css/components.css'
import './css/auth.css'

import { h } from './js/utils/dom.js'
import { routeTable } from './js/config/routes.js'
import { startRouter } from './js/router.js'
import { closeMobileDrawer, sidebar, topBar } from './js/components/sidebar.js'
import { toast } from './js/components/notifications.js'
import { authErrorMessage, watchAuthState } from './js/auth/auth.js'

import { render as login } from './js/pages/login.js'
import { render as register } from './js/pages/register.js'
import { render as forgotPassword } from './js/pages/forgotPassword.js'
import { render as resetPassword } from './js/pages/resetPassword.js'
import { render as dashboard } from './js/pages/dashboard.js'
import { render as semesters } from './js/pages/semesters.js'
import { render as subjects } from './js/pages/subjects.js'
import { render as subjectDetail } from './js/pages/subjectDetail.js'
import { render as assessments } from './js/pages/assessments.js'
import { render as gradeCalculator } from './js/pages/gradeCalculator.js'
import { render as gradePredictor } from './js/pages/gradePredictor.js'
import { render as gwa } from './js/pages/gwaCalculator.js'
import { render as history } from './js/pages/history.js'
import { render as analytics } from './js/pages/analytics.js'
import { render as settings } from './js/pages/settings.js'
import { render as demo } from './js/pages/demo.js'
import { render as notFound } from './js/pages/notFound.js'

const app = document.querySelector('#app')
watchAuthState(() => {
  window.location.hash = '#/reset-password'
})
const skipLink = h('a', { className: 'skip-link', href: '#main-content', text: 'Skip to main content' })
const publicContainer = h('main', { className: 'auth-layout' })
const shell = h('div', { className: 'app-shell' })
const backdrop = h('button', { className: 'sidebar-backdrop', type: 'button', ariaLabel: 'Close menu' })
const main = h('main', { className: 'main-content', id: 'main-content', tabIndex: '-1' })
const inner = h('div', { className: 'main-content__inner' })
const appTopBar = topBar()
main.append(appTopBar, inner)

backdrop.addEventListener('click', () => {
  closeMobileDrawer()
})
shell.append(sidebar(), backdrop, main)

const pageMap = {
  login,
  register,
  'forgot-password': forgotPassword,
  'reset-password': resetPassword,
  dashboard,
  semesters,
  subjects,
  'subject-detail': subjectDetail,
  assessments,
  'grade-calculator': gradeCalculator,
  'grade-predictor': gradePredictor,
  gwa,
  history,
  analytics,
  settings,
  demo
}

function updateNavigation(route) {
  document.querySelectorAll('.sidebar__link').forEach((link) => {
    const routePath = route?.path
    const linkPath = link.hash.replace(/^#/, '')
    const active = routePath === '/subjects' && linkPath === '/subjects'
      ? true
      : routePath === '/subjects/:id' && linkPath === '/subjects'
        ? true
        : linkPath === '/gwa' && (routePath === '/gwa' || routePath === '/gwa-calculator')
          ? true
        : linkPath === routePath
    if (active) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  })
  closeMobileDrawer(false)
}

startRouter({
  routeTable,
  pageMap,
  container: inner,
  notFound,
  onNavigate: ({ route }) => {
    const publicRoute = route && !route.requiresAuth && route.name !== 'demo'
    if (publicRoute) {
      publicContainer.replaceChildren(...Array.from(inner.childNodes))
      app.replaceChildren(skipLink, publicContainer)
    } else {
      app.replaceChildren(skipLink, shell)
    }
    updateNavigation(route)
    if (route?.requiresAuth) appTopBar.refreshSemesterSwitcher()
  },
  onAuthRequired: (error) => {
    if (error) toast(authErrorMessage(error, 'login'), 'error')
  }
})
