export const session = {
  user: null,
  profile: null,
  activeSemester: null,
  recoveryPending: typeof sessionStorage !== 'undefined' && sessionStorage.getItem('gradi:password-recovery') === 'true',
  clear() {
    this.user = null
    this.profile = null
    this.activeSemester = null
    this.recoveryPending = false
  }
}
