import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.user) {
      // Redirect authenticated users to results page
      return NextResponse.redirect(`${origin}/results`)
    }
  }

  // URL to redirect to after sign in process completes (fallback to homepage)
  return NextResponse.redirect(`${origin}/`)
}
