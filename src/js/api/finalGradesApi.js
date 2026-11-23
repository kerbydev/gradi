import { supabase } from '../supabase.js'

export async function saveFinalGrade(subjectId, values) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase
    .from('final_grades')
    .upsert({ subject_id: subjectId, ...values }, { onConflict: 'subject_id' })
    .select()
    .single()
  if (error) throw error
  return data
}
