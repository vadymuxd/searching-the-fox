# Post-Deployment Configuration Guide

**IMPORTANT**: Complete these steps AFTER your first successful deployment to Vercel.

---

## Step 1: Get Your Vercel Production Domain

### 1.1 Find Your Domain

After your first deployment completes, Vercel shows you the domain:

```
🎉 Your deployment is ready!
https://searching-the-fox-xxxxx.vercel.app
```

**Copy this URL exactly!** You'll need it for all the next steps.

Example: `https://searching-the-fox-abc123.vercel.app`

---

## Step 2: Update Environment Variables in Vercel

### 2.1 Go to Vercel Project Settings

1. Go to: https://vercel.com/dashboard
2. Click on your project: **searching-the-fox**
3. Click **Settings** (top menu)
4. Click **Environment Variables** (left sidebar)

### 2.2 Update NEXT_PUBLIC_SITE_URL

1. Find the variable: `NEXT_PUBLIC_SITE_URL`
2. Click the **︙** (three dots) on the right
3. Click **Edit**
4. Enter your Vercel domain:
   ```
   https://searching-the-fox-xxxxx.vercel.app
   ```
   (Replace with YOUR actual domain)
5. Make sure **Production**, **Preview**, and **Development** are all checked
6. Click **Save**

### 2.3 Screenshot Reference

You should see:
```
Name: NEXT_PUBLIC_SITE_URL
Value: https://searching-the-fox-xxxxx.vercel.app
Environments: Production, Preview, Development ✓
```

---

## Step 3: Update Supabase Authentication Settings

### 3.1 Go to Supabase Auth Settings

1. Go to: https://supabase.com/dashboard/project/nwgusbtqxsakmukpniqo
2. Click **Authentication** in the left sidebar
3. Click **URL Configuration**

### 3.2 Update Site URL

1. Find **Site URL** field
2. **Replace** `http://localhost:3000` with your Vercel domain:
   ```
   https://searching-the-fox-xxxxx.vercel.app
   ```
3. **Important**: No trailing slash!
4. Click **Save**

### 3.3 Update Redirect URLs

Scroll down to **Redirect URLs** section.

**Add your Vercel domain:**
1. In the text field, enter:
   ```
   https://searching-the-fox-xxxxx.vercel.app/**
   ```
2. Click **Add URL**

**Keep localhost for development:**
3. Make sure you also have:
   ```
   http://localhost:3000/**
   ```

Your list should look like:
```
✓ https://searching-the-fox-xxxxx.vercel.app/**
✓ http://localhost:3000/**
```

4. Click **Save** at the bottom

---

## Step 4: Update Google OAuth Settings

### 4.1 Go to Google Cloud Console

1. Go to: https://console.cloud.google.com/apis/credentials
2. Sign in with your Google account
3. Find your OAuth 2.0 Client ID (the one you created earlier)
4. Click on it to edit

### 4.2 Update Authorized JavaScript Origins

Scroll to **Authorized JavaScript origins**

**Add your Vercel domain:**
1. Click **+ ADD URI**
2. Enter:
   ```
   https://searching-the-fox-xxxxx.vercel.app
   ```
   (No trailing slash, no wildcards)
3. Click **Add**

Your list should have:
```
✓ http://localhost:3000
✓ https://searching-the-fox-xxxxx.vercel.app
```

### 4.3 Update Authorized Redirect URIs

Scroll to **Authorized redirect URIs**

**The Supabase callback URL stays the same:**
```
✓ https://nwgusbtqxsakmukpniqo.supabase.co/auth/v1/callback
✓ http://localhost:54321/auth/v1/callback (if you have it)
```

**Important**: You do NOT need to add your Vercel domain here. Supabase handles the redirect.

### 4.4 Save Changes

1. Scroll to the bottom
2. Click **SAVE**
3. Wait for "Client ID updated" confirmation

---

## Step 5: Update GitHub OAuth Settings (If Configured)

### 5.1 Go to GitHub Developer Settings

1. Go to: https://github.com/settings/developers
2. Click **OAuth Apps**
3. Find your app: **Searching The Fox**
4. Click on it

### 5.2 Update Homepage URL

1. Find **Homepage URL**
2. Update to:
   ```
   https://searching-the-fox-xxxxx.vercel.app
   ```
3. Don't click Update yet!

### 5.3 Verify Authorization Callback URL

**Important**: This should stay as Supabase URL:
```
https://nwgusbtqxsakmukpniqo.supabase.co/auth/v1/callback
```

Do NOT change this to your Vercel domain.

### 5.4 Save

1. Click **Update application**
2. Wait for success message

---

## Step 6: Update LinkedIn OAuth Settings (If Configured)

### 6.1 Go to LinkedIn Developers

1. Go to: https://www.linkedin.com/developers/apps
2. Find your app: **Searching The Fox**
3. Click on it

### 6.2 Update App Settings

1. Go to **Settings** tab
2. Find **App website**
3. Update to:
   ```
   https://searching-the-fox-xxxxx.vercel.app
   ```
4. Click **Update**

### 6.3 Verify Redirect URLs

1. Go to **Auth** tab
2. Under **Redirect URLs**, you should have:
   ```
   https://nwgusbtqxsakmukpniqo.supabase.co/auth/v1/callback
   ```

**Important**: This stays as Supabase URL, NOT your Vercel domain.

---

## Step 7: Redeploy Your Application

After updating all the settings above, you need to redeploy so Vercel uses the new environment variables.

### 7.1 Trigger a Redeployment

**Option A: Via Vercel Dashboard**
1. Go to your project: https://vercel.com/dashboard
2. Click on **searching-the-fox**
3. Click **Deployments** tab
4. Find the latest deployment (top of the list)
5. Click the **︙** (three dots) on the right
6. Click **Redeploy**
7. Check **Use existing Build Cache**
8. Click **Redeploy**

**Option B: Push a Small Change**
```bash
cd "/Users/vadymshcherbakov/Documents/Work/Personal Projects/searching-the-fox"
git commit --allow-empty -m "Trigger redeployment with updated env vars"
git push origin main
```

### 7.2 Wait for Deployment

The redeployment takes 1-2 minutes. Wait for:
```
✓ Build completed
✓ Deployment ready
```

---

## Step 8: Test Your Production Deployment

### 8.1 Visit Your Production Site

Go to your Vercel domain:
```
https://searching-the-fox-xxxxx.vercel.app
```

### 8.2 Test Authentication

**Test 1: Sign Up with Email**
1. Click **Sign In** button
2. Click **Sign up** link
3. Enter test email and password
4. Click **Create Account**
5. Should see success message
6. Should see your username in top right

**Test 2: Sign Out**
1. Click your username
2. Click **Sign Out**
3. Should see "Signed out successfully"
4. Should see **Sign In** button again

**Test 3: Sign In with Google OAuth**
1. Click **Sign In** button
2. Click **Continue with Google**
3. Should redirect to Google login
4. Sign in with your Google account
5. Should redirect back to your site
6. Should see your Google email/name in top right

### 8.3 Test Job Search

1. Enter a job search (e.g., "Software Engineer" in "London")
2. Click **Search**
3. Wait for results
4. Should see jobs displayed
5. Should see "saved to your account" if signed in

### 8.4 Test Database Integration

**If signed in:**
1. Refresh the page
2. Should still see your jobs (loaded from database)
3. Jobs should persist across page reloads

**If not signed in:**
1. Perform a search
2. Sign in
3. Should see "Move Local Data to DB" button
4. Click it
5. Should see success message
6. Refresh page - jobs should load from database

---

## Step 9: Verify Database in Supabase

### 9.1 Check Users Table

1. Go to: https://supabase.com/dashboard/project/nwgusbtqxsakmukpniqo
2. Click **Table Editor** (left sidebar)
3. Click **users** table
4. Should see your user account(s)

### 9.2 Check Jobs Table

1. Click **jobs** table
2. Should see jobs you searched for
3. Each job should have:
   - title, company, job_url, etc.
   - source_site (e.g., "LinkedIn", "Indeed")

### 9.3 Check User Jobs Table

1. Click **user_jobs** table
2. Should see entries linking your user to jobs
3. Each entry should have:
   - user_id (your UUID)
   - job_id (job UUID)
   - status: "new"

---

## Step 10: Check for Errors

### 10.1 Check Vercel Logs

1. Go to: https://vercel.com/dashboard
2. Click **searching-the-fox**
3. Click **Deployments** tab
4. Click on latest deployment
5. Click **Functions** tab
6. Look for any errors in the logs

### 10.2 Check Browser Console

1. Open your production site
2. Open Developer Tools (F12 or Cmd+Option+I)
3. Go to **Console** tab
4. Look for any errors (red text)
5. Should see no critical errors

### 10.3 Check Supabase Logs

1. Go to: https://supabase.com/dashboard/project/nwgusbtqxsakmukpniqo
2. Click **Logs** (left sidebar)
3. Click **Auth Logs**
4. Should see successful sign-in/sign-up events

---

## Troubleshooting Common Issues

### Issue 1: "Redirect URI mismatch" when signing in with Google

**Solution:**
- ✅ Check Google Console → Authorized JavaScript origins includes your Vercel domain
- ✅ Check Authorized redirect URIs has the Supabase callback URL
- ✅ No trailing slashes
- ✅ HTTPS (not HTTP) for Vercel domain

### Issue 2: "Invalid Site URL" error

**Solution:**
- ✅ Check Supabase → Auth → URL Configuration
- ✅ Site URL should be your Vercel domain (no trailing slash)
- ✅ Redirect URLs should include `/**` wildcard
- ✅ Redeploy after changing

### Issue 3: User can sign in but gets logged out immediately

**Solution:**
- ✅ Check middleware.ts is running
- ✅ Check cookies are being set (DevTools → Application → Cookies)
- ✅ Check `NEXT_PUBLIC_SITE_URL` matches your actual domain
- ✅ Check Supabase Site URL matches Vercel domain

### Issue 4: Database operations fail

**Solution:**
- ✅ Check RLS policies are enabled in Supabase
- ✅ Check user is actually authenticated
- ✅ Check environment variables are set correctly
- ✅ Check Vercel logs for specific error messages

### Issue 5: "CORS error" in browser console

**Solution:**
- ✅ Check `NEXT_PUBLIC_SUPABASE_URL` is correct
- ✅ Check no typos in environment variables
- ✅ Check Supabase project is not paused
- ✅ Redeploy after fixing

---

## Summary Checklist

After completing all steps, verify:

- ✅ Vercel domain is live and accessible
- ✅ `NEXT_PUBLIC_SITE_URL` updated in Vercel
- ✅ Supabase Site URL updated to Vercel domain
- ✅ Supabase Redirect URLs include Vercel domain with `/**`
- ✅ Google OAuth origins updated with Vercel domain
- ✅ GitHub/LinkedIn homepage URLs updated (if using)
- ✅ Application redeployed
- ✅ Email sign-up/sign-in works
- ✅ Google OAuth sign-in works
- ✅ Job search works and saves to database
- ✅ Jobs persist after page refresh
- ✅ No errors in Vercel logs
- ✅ No errors in browser console
- ✅ Database tables populated correctly

---

## Quick Reference

**Your Vercel Domain:**
```
https://searching-the-fox-xxxxx.vercel.app
```

**Supabase Callback URL (don't change):**
```
https://nwgusbtqxsakmukpniqo.supabase.co/auth/v1/callback
```

**Where to Update Your Domain:**
- ✅ Vercel: Environment Variables → `NEXT_PUBLIC_SITE_URL`
- ✅ Supabase: Auth → URL Configuration → Site URL
- ✅ Supabase: Auth → URL Configuration → Redirect URLs → Add with `/**`
- ✅ Google: Cloud Console → OAuth Client → Authorized JavaScript origins
- ✅ GitHub: OAuth App → Homepage URL
- ✅ LinkedIn: App Settings → App website

---

**Status**: Ready for production testing! 🚀

If you encounter any issues, check the Troubleshooting section above or review the Vercel/Supabase logs for specific error messages.
