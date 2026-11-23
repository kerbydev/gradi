import { supabase } from '../supabase.js'
export async function getProfile() {
  if (!supabase) return null
  const { data, error } = await supabase.from('profiles').select('*').single()
  if (error && error.code !== 'PGRST116') throw error
  return data
}
export async function updateProfile(values) {
  const { data, error } = await supabase.from('profiles').update(values).eq('id', (await supabase.auth.getUser()).data.user.id).select().single()
  if (error) throw error
  return data
}
