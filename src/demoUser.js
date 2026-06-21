import { supabase } from './supabaseClient'

const USER_KEY = 'demoUserId'

export function getDemoUserId() {
  let userId = localStorage.getItem(USER_KEY)
  if (!userId) {
    userId = crypto.randomUUID()
    localStorage.setItem(USER_KEY, userId)
    supabase.from('users').insert({ id: userId }).then(({ error }) => {
      if (error) console.warn('[demo] user insert:', error.message)
    })
  }
  return userId
}
