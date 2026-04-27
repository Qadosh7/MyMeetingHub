import { createClient } from '@supabase/supabase-js'

// Prioritize environment variables, then use values provided by the user as defaults
const rawUrl = import.meta.env.VITE_SUPABASE_URL || 'https://feuozcaguzhurqotvalt.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tQxTYQc1UYqpN-yZKSXJxQ_7zP9_JUU'

// The Supabase client requires the base project URL, not the REST endpoint.
// If the user provided the REST endpoint, we extract the base URL.
const supabaseUrl = rawUrl.includes('/rest/v1') ? rawUrl.split('/rest/v1')[0] : rawUrl

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase configuration missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
)
