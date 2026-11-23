import { supabase } from '../supabase.js'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.')
}

export async function listGradingProfiles() {
  requireSupabase()
  const { data, error } = await supabase
    .from('grading_profiles')
    .select('*,grading_rules(*)')
    .order('created_at')
  if (error) throw error
  return data ?? []
}

export async function getGradingProfile(id) {
  requireSupabase()
  const { data, error } = await supabase
    .from('grading_profiles')
    .select('*,grading_rules(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function setDefaultGradingProfile(id) {
  requireSupabase()
  const { error } = await supabase.rpc('set_default_grading_profile', { p_profile_id: id })
  if (error) throw error
}

export async function getDefaultGradingProfile() {
  requireSupabase()
  const { data, error } = await supabase
    .from('grading_profiles')
    .select('*,grading_rules(*)')
    .eq('is_default', true)
    .maybeSingle()
  if (error) throw error
  return data
}
