import { supabase } from '../supabase.js'

export async function clearGradiData() {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.rpc('clear_my_gradi_data')
  if (error) throw error
}
