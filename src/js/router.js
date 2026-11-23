import { getSession } from './auth/auth.js'
import { session } from './state/session.js'
import { isUuid } from './utils/validate.js'

function matchRoute(hashPath, route) {
  const actual = hashPath.split('/').filter(Boolean)
  const expected = route.path.split('/').filter(Boolean)
  if (actual.length !== expected.length) return null

  const params = {}
  for (let index = 0; index < expected.length; index += 1) {
    const segment = expected[index]
    if (segment.startsWith(':')) {
      params[segment.slice(1)] = decodeURIComponent(actual[index])
    } else if (segment !== actual[index]) {
      return null
    }
  }
  return params
}

export function startRouter({ routeTable, pageMap, container, notFound, onNavigate, onAuthRequired }) {
  let activeCleanup = null
  let navigationId = 0

  async function navigate() {
    const currentNavigation = ++navigationId
    const hash = window.location.hash || '#/login'
    const hashPath = `/${hash.replace(/^#\/?/, '').replace(/\/+$/, '')}`
    let match = null

    for (const route of routeTable) {
      const params = matchRoute(hashPath, route)
      if (params) {
        match = { route, params }
        break
      }
    }

    if (activeCleanup) {
      activeCleanup()
      activeCleanup = null
    }

    if (!match) {
      await notFound(container, { path: hashPath })
      onNavigate?.({ route: null, params: {}, path: hashPath })
      return
    }

    if (match.route.requiresAuth) {
      let user = null
      try {
        user = await getSession()
      } catch (error) {
        onAuthRequired?.(error)
      }
      if (currentNavigation !== navigationId) return
      if (!user) {
        window.location.hash = '#/login'
        return
      }
    }
    if (!match.route.requiresAuth && ['login', 'register', 'forgot-password'].includes(match.route.name)) {
      let user = null
      try {
        user = await getSession()
      } catch (error) {
        onAuthRequired?.(error)
      }
      if (currentNavigation !== navigationId) return
      if (user) {
        window.location.hash = session.recoveryPending ? '#/reset-password' : '#/dashboard'
        return
      }
    }

    for (const [key, rule] of Object.entries(match.route.paramRules || {})) {
      if (rule === 'uuid' && !isUuid(match.params[key])) {
        await notFound(container, { path: hashPath, invalidParam: key })
        onNavigate?.({ route: match.route, params: match.params, path: hashPath })
        return
      }
    }

    const render = pageMap[match.route.name]
    if (!render) {
      await notFound(container, { path: hashPath })
    } else {
      const cleanup = await render(container, match.params)
      if (typeof cleanup === 'function') activeCleanup = cleanup
    }
    onNavigate?.({ route: match.route, params: match.params, path: hashPath })
  }

  window.addEventListener('hashchange', navigate)
  navigate()

  return () => {
    window.removeEventListener('hashchange', navigate)
    if (activeCleanup) activeCleanup()
  }
}
