# Email Confirmation Setup Guide

## 1. Custom Email Template

Replace the default Supabase email template with the custom HTML template provided in `email-template.html`. 

In your Supabase Dashboard:
1. Go to **Authentication** → **Email Templates**
2. Select **Confirm signup** template
3. Replace the content with the HTML from `email-template.html`
4. Save the template

## 2. Site URL Configuration

Update your Supabase site URL to use the custom confirmation callback:

In your Supabase Dashboard:
1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL** to: `https://searching-the-fox.vercel.app/auth/callback/confirm`
3. Add the following **Redirect URLs**:
   - `https://searching-the-fox.vercel.app/auth/callback/confirm`
   - `https://searching-the-fox.vercel.app/auth/callback`
   - `https://searching-the-fox.vercel.app/`

## 3. How the Flow Works

### New User Email Confirmation Flow:
1. User signs up with email/password
2. User receives custom styled email with confirmation link
3. User clicks confirmation link → redirects to `/auth/confirm`
4. Server verifies the token → redirects to `/auth/callback/confirm`
5. Client-side page loads and:
   - Confirms email verification
   - Checks for localStorage data
   - Migrates any existing job search data to database
   - Signs user in automatically
   - Redirects to `/results` page

### Existing User Email Confirmation (if needed):
- Same flow works for existing users
- If they have localStorage data, it gets migrated
- If they don't, they just get signed in and redirected

### OAuth Users:
- Continue to use the existing `/auth/callback` route
- Get redirected directly to `/results`

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