import { clearGradiData } from '../api/accountDataApi.js'
import { listGradingProfiles, setDefaultGradingProfile } from '../api/gradingProfilesApi.js'
import { listSemesters, setActiveSemester } from '../api/semestersApi.js'
import { getProfile, updateProfile } from '../api/profileApi.js'
import { loadAcademicRecords } from '../api/academicRecordsApi.js'
import { createGradingRulesEditor } from '../components/finalGradePanel.js'
import { openModal } from '../components/modal.js'
import { toast } from '../components/notifications.js'
import { authErrorMessage, signOut, updatePassword } from '../auth/auth.js'
import { session } from '../state/session.js'
import { dataErrorMessage } from '../utils/apiError.js'
import { h } from '../utils/dom.js'

const DELETE_PHRASE = 'DELETE MY DATA'

function showDeleteDataConfirmation() {
  const form = h('form', { className: 'form delete-data-form' })
  const input = h('input', {
    id: 'delete-data-confirmation',
    type: 'text',
    autocomplete: 'off',
    spellcheck: false,
    ariaLabel: `Type ${DELETE_PHRASE} to confirm`
  })
  const error = h('p', { className: 'field-error', ariaLive: 'polite' })
  const submit = h('button', {
    className: 'button button--danger',
    type: 'submit',
    text: 'Delete Gradi data',
    disabled: true
  })
  form.append(
    h('p', { text: 'This permanently deletes your semesters, subjects, assessments, final grades, and custom grading rules, and resets your Gradi profile.' }),
    h('p', { className: 'text-muted', text: 'Your Supabase sign-in account is not deleted. Type DELETE MY DATA to confirm.' }),
    h('label', { for: 'delete-data-confirmation', text: `Type ${DELETE_PHRASE}` }),
    input,
    error,
    submit
  )

  const close = openModal('Delete my Gradi data', form)
  input.addEventListener('input', () => {
    submit.disabled = input.value !== DELETE_PHRASE
    error.textContent = ''
  })
  form.addEventListener('submit', async event => {
    event.preventDefault()
    if (input.value !== DELETE_PHRASE) {
      error.textContent = `Type ${DELETE_PHRASE} exactly to continue.`
      return
    }

    submit.disabled = true
    try {
      await clearGradiData()
      close()
      toast('Your Gradi data was deleted. Your Supabase sign-in account remains active.')
      try {
        await signOut()
      } catch (signOutError) {
        toast(authErrorMessage(signOutError, 'logout'), 'error')
      }
    } catch (deleteError) {
      error.textContent = dataErrorMessage(deleteError, 'Could not delete your Gradi data. Ensure the latest database schema is installed, then try again.')
      submit.disabled = false
    }
  })
}

function downloadJson(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const objectUrl = URL.createObjectURL(blob)
  const link = h('a', { href: objectUrl, download: `gradi-export-${new Date().toISOString().slice(0, 10)}.json` })
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
}

export async function render(container) {
  const heading = h('div', { className: 'page-heading' }, [
    h('div', {}, [h('p', { className: 'eyebrow', text: 'Preferences' }), h('h1', { text: 'Settings' })])
  ])
  container.replaceChildren(heading, h('div', { className: 'skeleton', ariaLabel: 'Loading settings' }))

  let profile
  let semesters
  let gradingProfiles
  try {
    [profile, semesters, gradingProfiles] = await Promise.all([
      getProfile(),
      listSemesters(),
      listGradingProfiles()
    ])
  } catch (error) {
    container.replaceChildren(heading, h('div', { className: 'empty-state' }, [
      h('strong', { text: 'Could not load settings' }),
      h('p', { text: dataErrorMessage(error, 'Try again in a moment.') })
    ]))
    return
  }

  const profileForm = h('form', { className: 'card form settings-profile-form' })
  const name = h('input', { id: 'settings-name', type: 'text', autocomplete: 'name', value: profile?.full_name ?? '' })
  const university = h('input', { id: 'settings-university', type: 'text', required: true, value: profile?.university ?? 'MSU-IIT' })
  const program = h('input', { id: 'settings-program', type: 'text', value: profile?.program ?? '' })
  const yearLevel = h('input', { id: 'settings-year-level', type: 'text', value: profile?.year_level ?? '' })
  const decimals = h('select', { id: 'settings-gwa-decimals' }, [2, 3, 4].map(value => h('option', {
    value: String(value),
    text: String(value),
    selected: Number(profile?.gwa_decimals ?? 2) === value
  })))
  const profileError = h('p', { className: 'field-error', ariaLive: 'polite' })
  const saveProfile = h('button', { className: 'button button--primary', type: 'submit', text: 'Save profile' })
  profileForm.append(
    h('h2', { text: 'Profile' }),
    h('label', { for: 'settings-name', text: 'Full name' }), name,
    h('label', { for: 'settings-university', text: 'University' }), university,
    h('label', { for: 'settings-program', text: 'Program' }), program,
    h('label', { for: 'settings-year-level', text: 'Year level' }), yearLevel,
    h('label', { for: 'settings-gwa-decimals', text: 'GWA decimal places' }), decimals,
    profileError,
    saveProfile
  )
  profileForm.addEventListener('submit', async event => {
    event.preventDefault()
    profileError.textContent = ''
    saveProfile.disabled = true
    try {
      profile = await updateProfile({
        full_name: name.value.trim() || null,
        university: university.value.trim(),
        program: program.value.trim() || null,
        year_level: yearLevel.value.trim() || null,
        gwa_decimals: Number(decimals.value)
      })
      session.profile = profile
      toast('Profile settings saved.')
    } catch (error) {
      profileError.textContent = dataErrorMessage(error, 'Could not save your profile.')
    } finally {
      saveProfile.disabled = false
    }
  })

  const activeSection = h('section', { className: 'card form settings-active-semester' })
  const activeSelect = h('select', { id: 'settings-active-semester', ariaLabel: 'Active semester', disabled: semesters.length === 0 })
  for (const semester of semesters) {
    activeSelect.appendChild(h('option', {
      value: semester.id,
      text: `${semester.academic_year} · ${semester.term}${semester.status === 'active' ? ' · Active' : ''}`
    }))
  }
  if (!semesters.length) {
    activeSelect.appendChild(h('option', { value: '', text: 'No semesters yet' }))
  } else {
    const active = semesters.find(item => item.id === profile?.active_semester_id)
      ?? semesters.find(item => item.status === 'active')
      ?? semesters[0]
    activeSelect.value = active.id
  }
  const activeError = h('p', { className: 'field-error', ariaLive: 'polite' })
  activeSection.append(
    h('h2', { text: 'Active semester' }),
    h('p', { className: 'text-muted', text: 'This semester is selected across your dashboard and subject tools.' }),
    activeSelect,
    activeError,
    h('a', { href: '#/semesters', text: 'Manage semesters' })
  )
  activeSelect.addEventListener('change', async () => {
    activeError.textContent = ''
    const previousId = activeSelect.value
    activeSelect.disabled = true
    try {
      const active = await setActiveSemester(activeSelect.value)
      semesters.forEach(semester => {
        semester.status = semester.id === active.id ? 'active' : 'archived'
      })
      activeSelect.replaceChildren(...semesters.map(semester => h('option', {
        value: semester.id,
        text: `${semester.academic_year} · ${semester.term}${semester.status === 'active' ? ' · Active' : ''}`
      })))
      session.activeSemester = active
      session.profile = { ...(session.profile ?? profile), active_semester_id: active.id }
      profile = { ...(profile ?? {}), active_semester_id: active.id }
      window.dispatchEvent(new CustomEvent('semester:changed', { detail: { semester: active } }))
      window.dispatchEvent(new CustomEvent('semesters:changed'))
      activeSelect.value = active.id
      toast('Active semester updated.')
    } catch (error) {
      activeError.textContent = dataErrorMessage(error, 'Could not update the active semester.')
      activeSelect.value = previousId
    } finally {
      activeSelect.disabled = semesters.length === 0
    }
  })

  const passwordForm = h('form', { className: 'card form settings-password-form' })
  const newPassword = h('input', { id: 'settings-new-password', type: 'password', autocomplete: 'new-password', minlength: '8', required: true })
  const confirmPassword = h('input', { id: 'settings-confirm-password', type: 'password', autocomplete: 'new-password', minlength: '8', required: true })
  const passwordError = h('p', { className: 'field-error', ariaLive: 'polite' })
  const savePassword = h('button', { className: 'button button--primary', type: 'submit', text: 'Change password' })
  passwordForm.append(
    h('h2', { text: 'Change password' }),
    h('label', { for: 'settings-new-password', text: 'New password (at least 8 characters)' }),
    newPassword,
    h('label', { for: 'settings-confirm-password', text: 'Confirm new password' }),
    confirmPassword,
    passwordError,
    savePassword
  )
  passwordForm.addEventListener('submit', async event => {
    event.preventDefault()
    passwordError.textContent = ''
    if (newPassword.value.length < 8) {
      passwordError.textContent = 'Choose a password with at least 8 characters.'
      return
    }
    if (newPassword.value !== confirmPassword.value) {
      passwordError.textContent = 'Passwords do not match.'
      return
    }

    savePassword.disabled = true
    try {
      const { error } = await updatePassword(newPassword.value)
      if (error) throw error
      passwordForm.reset()
      toast('Password updated.')
    } catch (error) {
      passwordError.textContent = authErrorMessage(error, 'recovery')
    } finally {
      savePassword.disabled = false
    }
  })

  const gradingSection = h('section', { className: 'card settings-grading' })
  const gradingSelect = h('select', { id: 'settings-default-grading-profile', ariaLabel: 'Default grading profile' })
  const gradingError = h('p', { className: 'field-error', ariaLive: 'polite' })
  const rulesEditor = h('div', { className: 'settings-rules-editor' })
  function populateGradingProfiles() {
    gradingSelect.replaceChildren(...gradingProfiles.map(item => h('option', {
      value: item.id,
      text: item.name,
      selected: item.is_default
    })))
    gradingSelect.value = gradingProfiles.find(item => item.is_default)?.id ?? ''
  }
  function renderRulesEditor() {
    const selected = gradingProfiles.find(item => item.id === gradingSelect.value) ?? null
    rulesEditor.replaceChildren(createGradingRulesEditor(selected, reloadGradingProfiles))
  }
  async function reloadGradingProfiles() {
    gradingProfiles = await listGradingProfiles()
    populateGradingProfiles()
    renderRulesEditor()
  }
  populateGradingProfiles()
  gradingSection.append(
    h('h2', { text: 'Grading preferences' }),
    h('label', { for: 'settings-default-grading-profile', text: 'Default grading profile' }),
    gradingSelect,
    h('p', { className: 'text-muted', text: 'Subjects with their own profile keep using it; this profile is used when no subject-specific profile is selected.' }),
    gradingError,
    rulesEditor
  )
  gradingSelect.addEventListener('change', async () => {
    const selectedId = gradingSelect.value
    if (!selectedId) return
    gradingError.textContent = ''
    gradingSelect.disabled = true
    try {
      await setDefaultGradingProfile(selectedId)
      gradingProfiles = await listGradingProfiles()
      populateGradingProfiles()
      renderRulesEditor()
      toast('Default grading profile updated.')
    } catch (error) {
      gradingError.textContent = dataErrorMessage(error, 'Could not update the default grading profile. Ensure the latest database schema is installed.')
      gradingSelect.value = gradingProfiles.find(item => item.is_default)?.id ?? ''
    } finally {
      gradingSelect.disabled = false
    }
  })
  renderRulesEditor()

  const exportButton = h('button', { className: 'button button--secondary', type: 'button', text: 'Export my data as JSON' })
  exportButton.addEventListener('click', async () => {
    exportButton.disabled = true
    try {
      const [records, profiles] = await Promise.all([loadAcademicRecords(), listGradingProfiles()])
      const exportedSubjects = records.subjects.map(({ final_grade, ...subject }) => subject)
      downloadJson({
        exported_at: new Date().toISOString(),
        profile: records.profile,
        semesters: records.semesters,
        subjects: exportedSubjects,
        grading_profiles: profiles
      })
      toast('Your JSON export is ready.')
    } catch (error) {
      toast(dataErrorMessage(error, 'Could not export your data.'), 'error')
    } finally {
      exportButton.disabled = false
    }
  })
  const deleteButton = h('button', { className: 'button button--danger', type: 'button', text: 'Delete my Gradi data' })
  deleteButton.addEventListener('click', showDeleteDataConfirmation)
  const signOutButton = h('button', { className: 'button button--secondary', type: 'button', text: 'Sign out' })
  signOutButton.addEventListener('click', async () => {
    signOutButton.disabled = true
    try {
      await signOut()
    } catch (error) {
      toast(authErrorMessage(error, 'logout'), 'error')
    } finally {
      signOutButton.disabled = false
    }
  })
  const accountSection = h('section', { className: 'card form settings-account' }, [
    h('h2', { text: 'Account' }),
    h('p', { className: 'text-muted', text: 'Export a copy of your records or delete your Gradi profile and academic data. Deletion keeps your Supabase sign-in account.' }),
    h('div', { className: 'settings-account__actions' }, [signOutButton, exportButton, deleteButton])
  ])

  container.replaceChildren(
    heading,
    h('div', { className: 'settings-grid' }, [
      profileForm,
      activeSection,
      passwordForm,
      gradingSection,
      accountSection
    ])
  )
}
