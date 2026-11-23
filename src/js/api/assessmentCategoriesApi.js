import { supabase } from '../supabase.js'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.')
}

export async function createAssessmentCategory(values) {
  requireSupabase()
  const { data, error } = await supabase
    .from('assessment_categories')
    .insert(values)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateAssessmentCategory(id, values) {
  requireSupabase()
  const { data, error } = await supabase
    .from('assessment_categories')
    .update(values)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteAssessmentCategory(id) {
  requireSupabase()
  const { error } = await supabase.from('assessment_categories').delete().eq('id', id)
  if (error) throw error
}
