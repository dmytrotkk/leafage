import { createClient } from "@supabase/supabase-js"

import { createCore, createTransport } from "@leafage/core"

export async function signIn(email = process.env.LEAFAGE_TEST_EMAIL!, password = process.env.LEAFAGE_TEST_PASSWORD!) {
  const url = process.env.VITE_SUPABASE_URL!
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await db.auth.signInWithPassword({ email, password })
  if (error) throw error
  const transport = createTransport({ url, key, token: async () => data.session.access_token })
  return { db, transport, core: createCore(transport), uid: data.user.id }
}
