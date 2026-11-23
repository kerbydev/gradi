import { VALID_GRADES } from '../services/gradingRules.js'

export const MSU_IIT_NUMERIC_GRADES = VALID_GRADES.map(grade => ({
  grade,
  label: grade.toFixed(2)
}))
