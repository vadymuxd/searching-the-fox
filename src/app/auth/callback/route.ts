import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const origin = requestUrl.origin

  // Handle OAuth code exchange (for social logins)
  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.user) {
      // Redirect authenticated users to confirm page for localStorage migration
      return NextResponse.redirect(`${origin}/auth/callback/confirm?user_id=${data.user.id}&type=oauth`)
    }
    
    if (error) {
      console.error('OAuth callback error:', error)
      return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent(error.message)}`)
    }
  }

  // Handle email confirmation tokens
  if (token_hash && type) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.verifyOtp({
      type: type as 'email' | 'signup',
      token_hash,
    })

    if (error) {
      console.error('Email confirmation error:', error)
      return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent(error.message)}`)
    }

    if (data.user) {
      // Redirect confirmed users to confirm page for localStorage migration
      return NextResponse.redirect(`${origin}/auth/callback/confirm?user_id=${data.user.id}&type=email&confirmed=true`)
    }
  }

  // URL to redirect to after auth process completes (fallback to homepage)
  return NextResponse.redirect(`${origin}/`)
}
