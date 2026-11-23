import { supabase } from '../supabase.js'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.')
}

export async function listSubjects(semesterId) {
  requireSupabase()
  if (!semesterId) return []

  const { data, error } = await supabase
    .from('subjects')
    .select('*,assessment_categories(*),assessments(*),final_grades(*)')
    .eq('semester_id', semesterId)
    .order('code')
  if (error) throw error
  return data ?? []
}

export async function getSubject(id) {
  requireSupabase()
  const { data, error } = await supabase
    .from('subjects')
    .select('*,assessment_categories(*),assessments(*),final_grades(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createSubject(values) {
  requireSupabase()
  const { data, error } = await supabase.from('subjects').insert(values).select().single()
  if (error) throw error
  return data
}

export async function updateSubject(id, values) {
  requireSupabase()
  const { data, error } = await supabase
    .from('subjects')
    .update(values)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteSubject(id) {
  requireSupabase()
  const { error } = await supabase.from('subjects').delete().eq('id', id)
  if (error) throw error
}
