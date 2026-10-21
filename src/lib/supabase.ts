import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/** null quando o .env não foi configurado (o app mostra um aviso). */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        realtime: { params: { eventsPerSecond: 20 } },
      })
    : null
