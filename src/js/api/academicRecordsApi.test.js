import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./profileApi.js', () => ({ getProfile: vi.fn() }))
vi.mock('./semestersApi.js', () => ({ listSemesters: vi.fn() }))
vi.mock('./subjectsApi.js', () => ({ listSubjects: vi.fn() }))

import { getProfile } from './profileApi.js'
import { listSemesters } from './semestersApi.js'
import { listSubjects } from './subjectsApi.js'
import { loadAcademicRecords } from './academicRecordsApi.js'

describe('loadAcademicRecords', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('normalizes final-grade relations and associates flat subject rows with semesters', async () => {
    const semesters = [
      { id: 'semester-one', academic_year: '2025-2026', term: 'First' },
      { id: 'semester-two', academic_year: '2025-2026', term: 'Second' }
    ]
    listSemesters.mockResolvedValue(semesters)
    getProfile.mockResolvedValue({ gwa_decimals: 3 })
    listSubjects.mockImplementation(async id => id === 'semester-one'
      ? [
        { id: 'subject-one', units: 3, final_grades: [{ grade_value: 1.25, source: 'computed' }] },
        { id: 'subject-inc', units: 2, final_grades: [{ status: 'INC', source: 'manual' }] }
      ]
      : [{ id: 'subject-two', units: 1, final_grades: { grade_value: 3, source: 'manual' } }])

    const records = await loadAcademicRecords()

    expect(records.profile.gwa_decimals).toBe(3)
    expect(records.semesterRecords).toHaveLength(2)
    expect(records.subjects).toMatchObject([
      { id: 'subject-one', semester_id: 'semester-one', final_grade: { grade_value: 1.25 } },
      { id: 'subject-inc', semester_id: 'semester-one', final_grade: { status: 'INC' } },
      { id: 'subject-two', semester_id: 'semester-two', final_grade: { grade_value: 3 } }
    ])
    expect(listSubjects).toHaveBeenCalledTimes(2)
  })
})
