export function sumSubjectUnits(subjects) {
  return subjects.reduce((total, subject) => {
    const units = Number(subject.units)
    return Number.isFinite(units) && units > 0 ? total + units : total
  }, 0)
}
