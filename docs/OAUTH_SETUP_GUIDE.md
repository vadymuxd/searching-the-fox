# OAuth Setup Guide - Google, GitHub, LinkedIn

This guide will walk you through setting up OAuth providers for Searching The Fox.

---

## 🔵 Google OAuth Setup

### Step 1: Create Google OAuth Credentials

1. **Go to Google Cloud Console**:
   - Visit: https://console.cloud.google.com/
   - Sign in with your Google account

2. **Create or Select a Project**:
   - Click on the project dropdown at the top
   - Click **"New Project"**
   - Name it: `Searching The Fox`
   - Click **"Create"**

3. **Enable Google+ API**:
   - In the search bar, type "Google+ API"
   - Click on it and click **"Enable"**

4. **Configure OAuth Consent Screen**:
   - Go to **APIs & Services** → **OAuth consent screen**
   - Choose **External** (unless you have a Google Workspace)
   - Click **"Create"**
   
   **Fill in the required fields**:
   - App name: `Searching The Fox`
   - User support email: Your email
   - App logo: (optional) Upload your fox logo
   - Application home page: `http://localhost:3000` (or your production URL)
   - Authorized domains: 
     - `localhost` (for development)
     - Your production domain (e.g., `searchingthefox.com`)
   - Developer contact email: Your email
   - Click **"Save and Continue"**
   
   **Scopes** (Step 2):
   - Click **"Add or Remove Scopes"**
   - Select: `userinfo.email` and `userinfo.profile`
   - Click **"Update"** → **"Save and Continue"**
   
   **Test Users** (Step 3):
   - Add your email for testing
   - Click **"Save and Continue"**

5. **Create OAuth Credentials**:
   - Go to **APIs & Services** → **Credentials**
   - Click **"+ Create Credentials"** → **"OAuth client ID"**
   - Application type: **Web application**
   - Name: `Searching The Fox Web Client`
   
   **Authorized JavaScript origins**:
   - `http://localhost:3000` (for development)
   - Your production URL (e.g., `https://searchingthefox.com`)
   
   **Authorized redirect URIs**:
   - `https://nwgusbtqxsakmukpniqo.supabase.co/auth/v1/callback`
   - `http://localhost:54321/auth/v1/callback` (if using local Supabase)
   
   - Click **"Create"**

6. **Copy Your Credentials**:
   - You'll see a popup with:
     - **Client ID**: `xxxxx.apps.googleusercontent.com`
     - **Client Secret**: `GOCSPX-xxxxx`
   - Keep these handy for the next step!

---

### Step 2: Configure Google in Supabase

1. **Go to Supabase Dashboard**:
   - Visit: https://supabase.com/dashboard/project/nwgusbtqxsakmukpniqo
   - Navigate to **Authentication** → **Providers**

2. **Find Google Provider**:
   - Scroll down and find **Google**
   - Toggle it **ON** (enable it)

3. **Enter Credentials**:
   - **Client ID (for OAuth)**: Paste your Google Client ID
   - **Client Secret (for OAuth)**: Paste your Google Client Secret
   - Leave other settings as default

4. **Site URL** (Important!):
   - Go to **Authentication** → **URL Configuration**
   - Set **Site URL**: 
     - Development: `http://localhost:3000`
     - Production: Your production URL
   - Set **Redirect URLs**:
     - `http://localhost:3000/**`
     - Your production URL with `/**`

5. **Click "Save"**

---

## ⚫ GitHub OAuth Setup

### Step 1: Create GitHub OAuth App

1. **Go to GitHub Developer Settings**:
   - Visit: https://github.com/settings/developers
   - Click **"OAuth Apps"**
   - Click **"New OAuth App"**

2. **Fill in Application Details**:
   - **Application name**: `Searching The Fox`
   - **Homepage URL**: `http://localhost:3000` (or production URL)
   - **Application description**: `Job search and application tracking platform`
   - **Authorization callback URL**: `https://nwgusbtqxsakmukpniqo.supabase.co/auth/v1/callback`
   - Click **"Register application"**

3. **Generate Client Secret**:
   - Click **"Generate a new client secret"**
   - Copy both:
     - **Client ID**: `xxxxx`
     - **Client Secret**: `xxxxx`

---

### Step 2: Configure GitHub in Supabase

1. **Go to Supabase Dashboard**:
   - Navigate to **Authentication** → **Providers**

2. **Find GitHub Provider**:
   - Toggle it **ON**

3. **Enter Credentials**:
   - **Client ID**: Paste your GitHub Client ID
   - **Client Secret**: Paste your GitHub Client Secret

4. **Click "Save"**

---

## 🔵 LinkedIn OAuth Setup

### Step 1: Create LinkedIn App

1. **Go to LinkedIn Developers**:
   - Visit: https://www.linkedin.com/developers/apps
   - Click **"Create app"**

2. **Fill in App Details**:
   - **App name**: `Searching The Fox`
   - **LinkedIn Page**: (select or create a company page)
   - **App logo**: Upload your fox logo
   - **Privacy policy URL**: Your privacy policy URL
   - **App website**: `http://localhost:3000` or production URL
   - Check the **Legal Agreement** box
   - Click **"Create app"**

3. **Get Credentials**:
   - Go to the **Auth** tab
   - Copy:
     - **Client ID**: `xxxxx`
     - **Client Secret**: Click "Show" and copy

4. **Add Redirect URLs**:
   - In the **Auth** tab, under **Redirect URLs**
   - Add: `https://nwgusbtqxsakmukpniqo.supabase.co/auth/v1/callback`
   - Click **"Update"**

5. **Request Access to Sign In with LinkedIn**:
   - Go to the **Products** tab
   - Find **"Sign In with LinkedIn using OpenID Connect"**
   - Click **"Request access"**
   - Wait for approval (usually instant)

---

### Step 2: Configure LinkedIn in Supabase

1. **Go to Supabase Dashboard**:
   - Navigate to **Authentication** → **Providers**

2. **Find LinkedIn (OIDC) Provider**:
   - Scroll down to **LinkedIn (OIDC)**
   - Toggle it **ON**

3. **Enter Credentials**:
   - **Client ID**: Paste your LinkedIn Client ID
   - **Client Secret**: Paste your LinkedIn Client Secret

4. **Click "Save"**

---

## 🧪 Testing OAuth

### After Setup, Test Each Provider:

1. **Start your dev server**:
   ```bash
   npm run dev
   ```

2. **Click "Sign In"** on your homepage

3. **Try each OAuth button**:
   - Click **"Continue with Google"**
   - You should be redirected to Google login
   - After authorizing, you should be redirected back and signed in

4. **Check Supabase Dashboard**:
   - Go to **Authentication** → **Users**
   - You should see your new user account

---

## 📋 Quick Reference - Your Supabase Callback URL

Use this URL for ALL OAuth providers:

```
https://nwgusbtqxsakmukpniqo.supabase.co/auth/v1/callback
```

**For local development** (if using local Supabase):
```
http://localhost:54321/auth/v1/callback
```

---

## 🐛 Troubleshooting

### Error: "Unsupported provider: provider is not enabled"
- ✅ Go to Supabase → Authentication → Providers
- ✅ Make sure the provider is toggled **ON**
- ✅ Make sure you saved the configuration

### Error: "redirect_uri_mismatch"
- ✅ Check that the redirect URI in Google/GitHub/LinkedIn matches exactly
- ✅ Must be: `https://nwgusbtqxsakmukpniqo.supabase.co/auth/v1/callback`
- ✅ No trailing slashes, must be HTTPS for production

### Error: "invalid_client"
- ✅ Double-check your Client ID and Client Secret
- ✅ Make sure there are no extra spaces when copying
- ✅ Regenerate the secret if needed

### OAuth redirects but not signed in
- ✅ Check your callback route exists at `/auth/callback`
- ✅ Check browser console for errors
- ✅ Verify middleware is running

### "This app hasn't been verified" (Google)
- This is normal for development
- Click **"Advanced"** → **"Go to Searching The Fox (unsafe)"**
- For production, you'll need to verify your app with Google

---

## 🚀 Production Deployment

Before deploying to production:

1. **Update OAuth redirect URIs** in all providers:
   - Replace `http://localhost:3000` with your production domain
   - Keep the Supabase callback URL the same

2. **Update Supabase Site URL**:
   - Go to **Authentication** → **URL Configuration**
   - Set production URL

3. **Verify Google App** (optional but recommended):
   - Go through Google's app verification process
   - Submit privacy policy and terms of service

4. **Test thoroughly**:
   - Test all OAuth providers in production
   - Verify email notifications work
   - Check user creation in database

---

**Need Help?**
- Google OAuth: https://developers.google.com/identity/protocols/oauth2
- GitHub OAuth: https://docs.github.com/en/apps/oauth-apps
- LinkedIn OAuth: https://learn.microsoft.com/en-us/linkedin/shared/authentication/authentication
- Supabase Auth: https://supabase.com/docs/guides/auth

---

**Status**: 📝 Follow this guide to enable OAuth providers!
