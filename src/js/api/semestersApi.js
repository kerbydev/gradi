import { supabase } from '../supabase.js'
import { session } from '../state/session.js'
import { getProfile } from './profileApi.js'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.')
}

export async function listSemesters() {
  requireSupabase()
  const { data, error } = await supabase
    .from('semesters')
    .select('*')
    .order('start_date', { ascending: false })
    .order('academic_year', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getSemesterContext() {
  const [semesters, profile] = await Promise.all([listSemesters(), getProfile()])
  const selected = semesters.find(item => item.id === profile?.active_semester_id)
    ?? semesters.find(item => item.status === 'active')
    ?? semesters[0]
    ?? null
  session.activeSemester = selected
  return { semesters, selected }
}

export async function createSemester(values) {
  requireSupabase()
  const { data, error } = await supabase.rpc('create_semester', {
    p_academic_year: values.academic_year,
    p_term: values.term,
    p_start_date: values.start_date,
    p_end_date: values.end_date || null,
    p_status: values.status || 'archived'
  })
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}

export async function updateSemester(id, values) {
  requireSupabase()
  const { data, error } = await supabase
    .from('semesters')
    .update(values)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function setActiveSemester(id) {
  requireSupabase()
  const { data, error } = await supabase.rpc('set_active_semester', { p_semester_id: id })
  if (error) throw error
  const semester = Array.isArray(data) ? data[0] : data
  if (!semester) throw new Error('Could not set the active semester.')
  session.activeSemester = semester
  return semester
}

export async function archiveSemester(id) {
  const semester = await updateSemester(id, { status: 'archived' })
  if (session.activeSemester?.id === id) session.activeSemester = semester
  return semester
}

export async function deleteSemester(id) {
  requireSupabase()
  const { error } = await supabase.from('semesters').delete().eq('id', id)
  if (error) throw error
  if (session.activeSemester?.id === id) session.activeSemester = null
}
