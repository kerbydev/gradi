import { getProfile } from './profileApi.js'
import { listSemesters } from './semestersApi.js'
import { listSubjects } from './subjectsApi.js'

function normalizeFinalGrade(subject) {
  const grades = subject.final_grades
  const finalGrade = Array.isArray(grades) ? grades[0] ?? null : grades ?? subject.final_grade ?? null
  return { ...subject, final_grade: finalGrade }
}

export async function loadAcademicRecords() {
  const [semesters, profile] = await Promise.all([listSemesters(), getProfile()])
  const semesterRecords = await Promise.all(semesters.map(async semester => ({
    semester,
    subjects: (await listSubjects(semester.id)).map(normalizeFinalGrade)
  })))
  const subjects = semesterRecords.flatMap(({ semester, subjects: semesterSubjects }) =>
    semesterSubjects.map(subject => ({ ...subject, semester_id: semester.id }))
  )

  return {
    profile,
    semesters,
    semesterRecords,
    subjects
  }
}
