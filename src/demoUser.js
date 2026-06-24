import { supabase } from './supabaseClient'

const USER_KEY = 'demoUserId'

export function getDemoUserId() {
  let userId = localStorage.getItem(USER_KEY)
  if (!userId) {
    userId = crypto.randomUUID()
    localStorage.setItem(USER_KEY, userId)
  }
  const now = new Date().toISOString()
  // upsert so re-runs are safe; ignoreDuplicates skips update if row already exists
  supabase.from('users')
    .upsert({ id: userId, created_at: now, updated_at: now }, { onConflict: 'id', ignoreDuplicates: true })
    .then(({ error }) => { if (error) console.warn('[demo] user upsert:', error.message) })
  return userId
}
