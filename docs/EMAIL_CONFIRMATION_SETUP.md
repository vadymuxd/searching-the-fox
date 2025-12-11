# Email Confirmation Setup Guide

## 1. Supabase Configuration

### A. Allow Sign-in with Unverified Email
In your Supabase Dashboard:
1. Go to **Authentication** → **Settings** 
2. Under **User Verification**, find "Enable email confirmations"
3. **UNCHECK** "Users must confirm their email before signing in"
4. This allows users to sign in immediately but still requires email confirmation for full access

### B. Custom Email Template
Replace the default Supabase email template with the custom HTML template provided in `email-template.html`. 

In your Supabase Dashboard:
1. Go to **Authentication** → **Email Templates**
2. Select **Confirm signup** template
3. Replace the content with the HTML from `email-template.html`
4. Save the template

### C. Site URL Configuration
Update your Supabase site URL to use the custom confirmation callback:

In your Supabase Dashboard:
1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL** to: `https://search-the-fox.com/auth/callback/confirm`
3. Add the following **Redirect URLs**:
   - `https://search-the-fox.com/auth/callback/confirm`
   - `https://search-the-fox.com/auth/callback`
   - `https://search-the-fox.com/`

## 2. How the Flow Works

### New User Sign-up Flow:
1. User signs up with email/password
2. User receives custom styled email with confirmation link
3. **User can immediately sign in with unverified email**
4. App shows "Please Confirm Your Email" screen until verification
5. When user clicks confirmation link → redirects to `/auth/confirm`
6. Server verifies the token → redirects to `/auth/callback/confirm`
7. Client-side page loads and:
   - Confirms email verification
   - Checks for localStorage data
   - Migrates any existing job search data to database
   - Signs user in automatically (if not already)
   - Redirects to `/results` page

### Sign-in with Unverified Email Flow:
1. User tries to sign in with unverified email
2. Sign-in succeeds (no error thrown)
3. User is redirected to homepage
4. App detects `user.email_confirmed_at` is null
5. Shows "Please Confirm Your Email" screen
6. User remains in this state until they click the confirmation link in their email

### Verified User Flow:
- Sign-in works normally
- User gets redirected to `/results` or homepage
- Full app functionality available

## 4. Key Features

- **Automatic Data Migration**: Any jobs saved in localStorage get automatically transferred to the database
- **Seamless Experience**: Users are signed in immediately after email confirmation
- **Error Handling**: Proper error messages and fallback redirects
- **Visual Feedback**: Loading states and success messages
- **Backwards Compatible**: Works for both new and existing users

## 5. Environment Variables

Make sure these are set in your deployment:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (for server-side operations)

## 6. File Structure

```
src/app/auth/
├── callback/
│   ├── confirm/
│   │   └── page.tsx          # Custom confirmation page with data migration
│   └── route.ts              # OAuth callback (existing)
└── confirm/
    └── route.ts              # Email verification endpoint (updated)
```

## 7. Testing

To test the flow:
1. Create a new account with email/password
2. Check email for the styled confirmation email
3. Click confirmation link
4. Verify you're signed in and redirected to `/results`
5. Check that any localStorage data was migrated to the database