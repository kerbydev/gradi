import { describe, expect, it } from 'vitest'
import { classifyAssessments } from './assessmentAnalytics.js'

describe('classifyAssessments', () => {
  it('separates completed, overdue, and due dates through the next 14 days', () => {
    const result = classifyAssessments([
      { id: 'completed-overdue', due_date: '2026-11-20', is_completed: true },
      { id: 'overdue', due_date: '2026-11-20', is_completed: false },
      { id: 'due-today', due_date: '2026-11-21', is_completed: false },
      { id: 'due-in-14-days', due_date: '2026-12-05', is_completed: false },
      { id: 'due-after-window', due_date: '2026-12-06', is_completed: false },
      { id: 'no-due-date', due_date: null, is_completed: false }
    ], new Date(2026, 10, 21))

    expect(result.total).toBe(6)
    expect(result.completed.map(item => item.id)).toEqual(['completed-overdue'])
    expect(result.overdue.map(item => item.id)).toEqual(['overdue'])
    expect(result.upcoming.map(item => item.id)).toEqual(['due-today', 'due-in-14-days'])
  })

  it('rejects invalid input explicitly', () => {
    expect(() => classifyAssessments(null)).toThrow('Assessments must be an array.')
  })
})
