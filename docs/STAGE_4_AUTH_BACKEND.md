# Stage 4: Authentication Setup Complete ✅

## What We Built

### 1. **Server Actions** (`src/lib/auth/actions.ts`)
Server-side authentication functions:
- ✅ `signUp()` - Register new user
- ✅ `signIn()` - Login with email/password
- ✅ `signOut()` - Logout user
- ✅ `getUser()` - Get current user
- ✅ `getSession()` - Get current session
- ✅ `resetPassword()` - Send password reset email
- ✅ `updatePassword()` - Update user password

### 2. **Auth Route Handlers**
- ✅ `/auth/callback/route.ts` - Handle OAuth redirects
- ✅ `/auth/confirm/route.ts` - Handle email confirmations

### 3. **Auth Context** (`src/lib/auth/AuthContext.tsx`)
Client-side React context for auth state:
- ✅ `AuthProvider` - Wraps app with auth context
- ✅ `useAuth()` - Hook to access user/session
- ✅ Real-time auth state updates

### 4. **Auth Utilities** (`src/lib/auth/utils.ts`)
Helper functions:
- ✅ `isAuthenticated()` - Check if user logged in
- ✅ `getCurrentUser()` - Get current user
- ✅ `getUserProfile()` - Get user profile from DB
- ✅ `updateUserPreferences()` - Update user preferences
- ✅ `updateUserMetadata()` - Update user metadata

---

## File Structure

```
src/
├── lib/
│   ├── auth/
│   │   ├── actions.ts           ✅ Server actions (signup/login/logout)
│   │   ├── AuthContext.tsx      ✅ Client context provider
│   │   └── utils.ts             ✅ Helper functions
│   └── supabase/
│       ├── client.ts            ✅ Browser client
│       ├── server.ts            ✅ Server client
│       └── middleware.ts        ✅ Session management
├── app/
│   └── auth/
│       ├── callback/
│       │   └── route.ts         ✅ OAuth callback handler
│       └── confirm/
│           └── route.ts         ✅ Email confirmation handler
└── middleware.ts                ✅ Root middleware
```

---

## How to Use

### Server Actions (Recommended)

Use these in Server Components or Client Components:

```typescript
import { signUp, signIn, signOut } from '@/lib/auth/actions'

// In a form submission
async function handleSignUp(formData: FormData) {
  const result = await signUp(formData)
  
  if (result.error) {
    console.error('Signup failed:', result.error)
  } else {
    console.log('Signup successful!')
  }
}
```

### Client-Side Auth Context

Use in Client Components to access auth state:

```typescript
'use client'

import { useAuth } from '@/lib/auth/AuthContext'

export function MyComponent() {
  const { user, session, loading } = useAuth()
  
  if (loading) return <div>Loading...</div>
  
  if (!user) return <div>Please log in</div>
  
  return <div>Welcome {user.email}</div>
}
```

### Server-Side Auth Check

Use in Server Components:

```typescript
import { getCurrentUser } from '@/lib/auth/utils'

export default async function ProtectedPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/login')
  }
  
  return <div>Protected content for {user.email}</div>
}
```

---

## Authentication Flow

### Signup Flow
```
1. User submits signup form
2. signUp() action called with FormData
3. Supabase creates auth.users entry
4. Trigger automatically creates users table entry
5. Email confirmation sent (if enabled)
6. User redirected to home
```

### Login Flow
```
1. User submits login form
2. signIn() action called with FormData
3. Supabase validates credentials
4. Session created and cookies set
5. User redirected to home
6. AuthContext updates with user data
```

### Logout Flow
```
1. User clicks logout
2. signOut() action called
3. Supabase clears session
4. Cookies cleared
5. User redirected to home
6. AuthContext updates (user = null)
```

---

## Email Configuration

### Enable Email Auth in Supabase

1. Go to Supabase Dashboard → Authentication → Providers
2. Enable **Email** provider (should be on by default)
3. Configure email templates (optional)

### Email Confirmation (Optional)

By default, Supabase requires email confirmation. To disable:

1. Go to Authentication → Settings
2. Disable "Enable email confirmations"

Or handle confirmations with the `/auth/confirm` route (already set up).

---

## OAuth Setup (For Later - Stage 6)

The infrastructure is ready for OAuth. To enable:

### Google OAuth Example

```typescript
'use client'

import { createClient } from '@/lib/supabase/client'

async function signInWithGoogle() {
  const supabase = createClient()
  
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
    }
  })
}
```

Enable in Supabase Dashboard → Authentication → Providers → Google

---

## Protected Routes

The middleware (`middleware.ts`) already handles session refresh. To protect specific routes:

### Option 1: Server Component Check

```typescript
import { getCurrentUser } from '@/lib/auth/utils'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/login')
  }
  
  return <div>Dashboard for {user.email}</div>
}
```

### Option 2: Middleware Enhancement

Update `middleware.ts` to protect routes:

```typescript
export async function middleware(request: NextRequest) {
  const response = await updateSession(request)
  
  // Protect specific routes
  const protectedPaths = ['/dashboard', '/profile', '/settings']
  const isProtected = protectedPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  )
  
  if (isProtected) {
    const supabase = createServerClient(...)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }
  
  return response
}
```

---

## User Profile Data

### Access User Preferences

```typescript
import { getUserProfile } from '@/lib/auth/utils'

const profile = await getUserProfile(user.id)

console.log(profile.preferences) 
// { defaultLocation: "London", defaultSite: "all", ... }
```

### Update Preferences

```typescript
import { updateUserPreferences } from '@/lib/auth/utils'

await updateUserPreferences(user.id, {
  defaultLocation: 'New York',
  defaultSite: 'linkedin',
  defaultHoursOld: '72'
})
```

---

## Next Steps

### Stage 6: Build Auth Frontend
- [ ] Create signup page UI
- [ ] Create login page UI
- [ ] Create password reset page
- [ ] Add user menu/profile dropdown
- [ ] Add "Sign up to save" prompts for anonymous users

### Stage 7: Connect Scraping to Database
- [ ] Save jobs to database on search
- [ ] Create user_jobs entries
- [ ] Migrate localStorage data on signup
- [ ] Pull jobs from database instead of localStorage

### Stage 8: Build Status Tabs UI
- [ ] Create tab navigation (New/Interested/Applied/etc.)
- [ ] Filter jobs by status
- [ ] Add status change buttons
- [ ] Update UI in real-time

---

## Testing

### Test Signup

```bash
# Using curl
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Test Login

Use the UI forms we'll create in Stage 6, or test server actions directly.

### Check User Created

In Supabase Dashboard → Authentication → Users

You should see the new user.

In Supabase Dashboard → Table Editor → users

You should see the corresponding profile (auto-created by trigger).

---

## Troubleshooting

### "User not found" Error
- Check if migration was run successfully
- Verify trigger `on_auth_user_created` exists
- Check users table has entry

### Email Not Sending
- Check Supabase email settings
- For development, check email in Supabase logs
- Consider disabling email confirmation for testing

### Session Not Persisting
- Check middleware is running
- Verify cookies are being set
- Check browser console for errors

---

## Security Notes

✅ **RLS Enabled** - All tables have Row Level Security
✅ **Server Actions** - Auth actions run on server, not exposed to client
✅ **Session Management** - Middleware automatically refreshes sessions
✅ **Password Hashing** - Supabase handles securely
✅ **HTTPS Required** - For production (handled by Vercel)

---

**Status**: ✅ Stage 4 Complete - Authentication Backend Ready!

Ready to build the frontend UI in Stage 6!
