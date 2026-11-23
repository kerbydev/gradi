import { supabase } from '../supabase.js'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.')
}

export async function createAssessment(values) {
  requireSupabase()
  const { data, error } = await supabase.from('assessments').insert(values).select().single()
  if (error) throw error
  return data
}

export async function updateAssessment(id, values) {
  requireSupabase()
  const { data, error } = await supabase
    .from('assessments')
    .update(values)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function upsertAssessment(values) {
  requireSupabase()
  const { data, error } = await supabase.from('assessments').upsert(values).select().single()
  if (error) throw error
  return data
}

export async function deleteAssessment(id) {
  requireSupabase()
  const { error } = await supabase.from('assessments').delete().eq('id', id)
  if (error) throw error
}
