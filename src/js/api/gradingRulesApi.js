import { supabase } from '../supabase.js'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.')
}

export async function createGradingRule(values) {
  requireSupabase()
  const { data, error } = await supabase.from('grading_rules').insert(values).select().single()
  if (error) throw error
  return data
}

export async function updateGradingRule(id, values) {
  requireSupabase()
  const { data, error } = await supabase
    .from('grading_rules')
    .update(values)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteGradingRule(id) {
  requireSupabase()
  const { error } = await supabase.from('grading_rules').delete().eq('id', id)
  if (error) throw error
}
