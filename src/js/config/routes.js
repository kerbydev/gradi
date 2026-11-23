export const routes = {
  login: '#/login',
  register: '#/register',
  forgotPassword: '#/forgot-password',
  resetPassword: '#/reset-password',
  dashboard: '#/dashboard',
  semesters: '#/semesters',
  subjects: '#/subjects',
  subjectDetail: '#/subjects/:id',
  assessments: '#/assessments',
  gradeCalculator: '#/grade-calculator',
  gradePredictor: '#/grade-predictor',
  gwa: '#/gwa',
  gwaCalculator: '#/gwa-calculator',
  history: '#/history',
  analytics: '#/analytics',
  settings: '#/settings'
}

export const routeTable = [
  { path: '/login', name: 'login', requiresAuth: false },
  { path: '/register', name: 'register', requiresAuth: false },
  { path: '/forgot-password', name: 'forgot-password', requiresAuth: false },
  { path: '/reset-password', name: 'reset-password', requiresAuth: false },
  { path: '/dashboard', name: 'dashboard', requiresAuth: true },
  { path: '/semesters', name: 'semesters', requiresAuth: true },
  { path: '/subjects', name: 'subjects', requiresAuth: true },
  { path: '/subjects/:id', name: 'subject-detail', requiresAuth: true, paramRules: { id: 'uuid' } },
  { path: '/assessments', name: 'assessments', requiresAuth: true },
  { path: '/grade-calculator', name: 'grade-calculator', requiresAuth: true },
  { path: '/grade-predictor', name: 'grade-predictor', requiresAuth: true },
  { path: '/gwa', name: 'gwa', requiresAuth: true },
  { path: '/gwa-calculator', name: 'gwa', requiresAuth: true },
  { path: '/history', name: 'history', requiresAuth: true },
  { path: '/analytics', name: 'analytics', requiresAuth: true },
  { path: '/settings', name: 'settings', requiresAuth: true },
  { path: '/demo', name: 'demo', requiresAuth: false }
]
