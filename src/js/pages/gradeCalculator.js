import { createStandaloneGradeTool } from '../components/subjectGradeTools.js'

export function render(container) {
  return createStandaloneGradeTool(container, 'calculator')
}
