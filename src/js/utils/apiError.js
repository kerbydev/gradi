export function dataErrorMessage(error, fallback) {
  if (error?.code === '23505') return 'A record with these details already exists.'
  if (error?.code === '23514' || error?.code === '22P02' || error?.code === '22007') {
    return 'Some values are invalid. Review the form and try again.'
  }
  if (error?.code === '42501') return 'You do not have permission to make this change.'
  if (error?.code === 'P0002') return 'The record no longer exists or is not accessible.'
  return fallback
}
