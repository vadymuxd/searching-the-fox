'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return !!user
}

/**
 * Get current user or null
 */
export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return null
  }

  return user
}

/**
 * Get user profile from custom users table
 */
export async function getUserProfile(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Error fetching user profile:', error)
    return null
  }

  return data
}

/**
 * Update user preferences
 */
export async function updateUserPreferences(userId: string, preferences: Record<string, unknown>) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('users')
    .update({ preferences })
    .eq('id', userId)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

/**
 * Update user metadata
 */
export async function updateUserMetadata(userId: string, metadata: Record<string, unknown>) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('users')
    .update({ metadata })
    .eq('id', userId)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
