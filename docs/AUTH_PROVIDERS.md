# Supabase Authentication Options

## ✅ YES! Supabase Auth Supports Multiple OAuth Providers

Supabase Auth supports a comprehensive list of OAuth providers that you can enable with just a few clicks.

---

## Supported OAuth Providers

### **Social Providers** (What You Asked About)

✅ **Google** - Yes, fully supported
✅ **GitHub** - Yes, fully supported  
✅ **LinkedIn** - Yes, fully supported (LinkedIn OIDC)

### **Other Popular Providers Available**

- **Apple** - Great for iOS users
- **Microsoft/Azure** - For enterprise users
- **Facebook** - Social login
- **Twitter/X** - Social login
- **Discord** - Great for gaming/tech communities
- **GitLab** - Developer-focused
- **Bitbucket** - Developer-focused
- **Slack** - Team collaboration
- **Spotify** - Music apps
- **Twitch** - Gaming/streaming
- **WorkOS** - Enterprise SSO
- **Zoom** - Video conferencing
- **Notion** - Productivity apps
- **Figma** - Design tools
- **Kakao** - Popular in South Korea
- **Keycloak** - Self-hosted identity

Plus many more! Full list: https://supabase.com/docs/guides/auth/social-login

---

## How to Enable OAuth Providers

### 1. **In Supabase Dashboard**

1. Go to: https://supabase.com/dashboard/project/nwgusbtqxsakmukpniqo
2. Navigate to: **Authentication → Providers**
3. Click on the provider you want (e.g., Google, GitHub, LinkedIn)
4. Toggle it **ON**
5. Add the required credentials (Client ID, Client Secret)

### 2. **Get OAuth Credentials**

Each provider requires you to create an OAuth app:

#### **Google OAuth**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `https://nwgusbtqxsakmukpniqo.supabase.co/auth/v1/callback`
6. Copy Client ID and Client Secret to Supabase

#### **GitHub OAuth**
1. Go to [GitHub Settings → Developer Settings](https://github.com/settings/developers)
2. Create new OAuth App
3. Authorization callback URL: `https://nwgusbtqxsakmukpniqo.supabase.co/auth/v1/callback`
4. Copy Client ID and Client Secret to Supabase

#### **LinkedIn OAuth**
1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/apps)
2. Create new app
3. Add redirect URL: `https://nwgusbtqxsakmukpniqo.supabase.co/auth/v1/callback`
4. Request "Sign In with LinkedIn" product
5. Copy Client ID and Client Secret to Supabase

---

## Implementation in Your App

### Basic Example (Client-Side)

```typescript
'use client';

import { createClient } from '@/lib/supabase/client';

export function LoginButtons() {
  const supabase = createClient();

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
  };

  const signInWithGitHub = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
  };

  const signInWithLinkedIn = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'linkedin_oidc',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
  };

  return (
    <div>
      <button onClick={signInWithGoogle}>Sign in with Google</button>
      <button onClick={signInWithGitHub}>Sign in with GitHub</button>
      <button onClick={signInWithLinkedIn}>Sign in with LinkedIn</button>
    </div>
  );
}
```

### Auth Callback Route

You'll need to create a callback route to handle OAuth redirects:

**`src/app/auth/callback/route.ts`**
```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Redirect to home or dashboard
  return NextResponse.redirect(requestUrl.origin);
}
```

---

## Authentication Methods We'll Support

### **Phase 1 (Stage 4)** - Basic Auth
- ✅ Email + Password (traditional signup/login)
- ✅ Email verification
- ✅ Password reset

### **Phase 2** - OAuth (Easy to Add Later)
- ✅ Google OAuth
- ✅ GitHub OAuth
- ✅ LinkedIn OAuth

### **Benefits of OAuth**
1. **Faster signup** - One-click registration
2. **No password management** - Users don't need to remember another password
3. **Trusted providers** - Users trust Google/GitHub/LinkedIn
4. **Auto-verified emails** - Email is already verified by the provider
5. **Professional** - Especially LinkedIn for a job search platform!

---

## Recommendation for Your Job Search Platform

Since you're building a **job search platform**, I highly recommend:

1. **Email/Password** - For users who prefer traditional signup
2. **Google** - Most users have Google accounts
3. **LinkedIn** - Perfect fit! Users likely have LinkedIn for job searching
4. **GitHub** - Great for tech job seekers

This covers ~95% of your target audience.

---

## Data Flow with OAuth

When a user signs in with OAuth:

1. User clicks "Sign in with Google"
2. Redirected to Google login page
3. Google authenticates user
4. Google redirects back to your app with auth code
5. Supabase exchanges code for session
6. **Your trigger creates user profile** in `users` table
7. User is logged in!

The email from OAuth provider is automatically available in `auth.users` and can be synced to your custom `users` table.

---

## Summary

✅ **YES** - Supabase supports Google, GitHub, and LinkedIn OAuth  
✅ **Easy to implement** - Just a few lines of code  
✅ **Professional** - OAuth is standard for modern apps  
✅ **Great UX** - One-click signup vs. forms  
✅ **Perfect for job platform** - LinkedIn OAuth is especially relevant!

**We'll implement Email/Password in Stage 4, and can add OAuth in Stage 6 or 7!**

---

## Resources

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Social Login Guide](https://supabase.com/docs/guides/auth/social-login)
- [OAuth Providers List](https://supabase.com/docs/guides/auth/social-login#providers)
