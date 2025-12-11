# External Services Migration Checklist

This document contains all the manual configuration changes you need to make in external services to complete the domain migration from `https://searching-the-fox.vercel.app` to `https://search-the-fox.com`.

Complete these tasks in order, checking off each box as you finish.

---

## 1. Cloudflare (DNS & SSL)

Configure DNS for your new domain on Cloudflare:

- [x] Log in to Cloudflare dashboard
- [x] Select domain `search-the-fox.com`
- [x] I did auto configuratiion via button in Vercel
- [ ] Add DNS records per Vercel's instructions (you'll get these in Step 2):
  - [ ] Add `CNAME` record: `search-the-fox.com` → `cname.vercel-dns.com` (or specific target from Vercel)
  - [ ] Optionally add `CNAME` for `www.search-the-fox.com` → `cname.vercel-dns.com`
- [ ] Set TLS/SSL mode:
  - [ ] Go to SSL/TLS settings
  - [ ] Set mode to **Full** or **Full (strict)**
- [ ] Confirm proxy status (orange cloud icon) is enabled for the records
- [ ] Wait for DNS propagation (usually 5-10 minutes, can take up to 24 hours)

---

## 2. Vercel (Domain & Environment Variables)

### A. Attach New Domain

- [x] Log in to Vercel dashboard
- [x] Select project: `searching-the-fox`
- [x] Go to **Settings** → **Domains**
- [x] Click **Add Domain**
- [x] Enter: `search-the-fox.com`
- [x] Follow Vercel's DNS configuration instructions (copy these to Cloudflare in Step 1)
- [x] I did auto configuratiion via button in Vercel
- [ ] Optionally add `www.search-the-fox.com` and configure redirect to apex
- [ ] Once DNS propagates, click **Refresh** in Vercel to verify
- [ ] Set `search-the-fox.com` as the **Primary Domain**
- [ ] Confirm SSL certificate shows as active

### B. Configure Redirects

Set up 301 redirects from old domain:

- [ ] In Vercel project, go to **Settings** → **Redirects** (or use `vercel.json`)
- [ ] Add redirect rule:
  - **Source:** `https://searching-the-fox.vercel.app/:path*`
  - **Destination:** `https://search-the-fox.com/:path*`
  - **Permanent:** `true` (301)
- [ ] Save and deploy
- [ ] Test: visit `https://searching-the-fox.vercel.app/` and confirm it redirects to `https://search-the-fox.com/`
- [ ] Test: visit `https://searching-the-fox.vercel.app/results` and confirm path is preserved

### C. Update Environment Variables

- [x] In Vercel project, go to **Settings** → **Environment Variables**
- [x] Find or create: `NEXT_PUBLIC_SITE_URL`
  - [x] Set **Production** value to: `https://search-the-fox.com`
  - [x] Set **Preview** value to: `https://search-the-fox.com` (or leave empty to use preview URL)
  - [ ] Set **Development** value to: `http://localhost:3000` (optional, for local override)
- [ ] Confirm all other env variables are present:
  - [x] `NEXT_PUBLIC_SUPABASE_URL`
  - [x] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [x] `NEXT_PUBLIC_API_URL`
  - [ ] `NEXT_PUBLIC_GEMINI_API_KEY`
  - [x] `RESEND_API_KEY`
  - [x] `CRON_SECRET`
  - [ ] Any other project-specific variables

### D. Redeploy

- [x] Trigger a new deployment (push to main or click **Redeploy** button)
- [x] Wait for deployment to complete
- [x] Visit `https://search-the-fox.com` and verify site loads correctly

---

## 3. Supabase (Authentication URLs)

Update Supabase to use the new domain for auth redirects:

- [x] Log in to Supabase dashboard
- [x] Select your project
- [x] Go to **Authentication** → **URL Configuration**

### A. Update Site URL

- [X] Set **Site URL** to: `https://search-the-fox.com`

### B. Update Redirect URLs

- [x] Click **Add URL** and add each of these:
  - [x] `https://search-the-fox.com/`
  - [x] `https://search-the-fox.com/auth/callback`
  - [x] `https://search-the-fox.com/auth/callback/confirm`
  - [x] `https://search-the-fox.com/auth/error`
  - [x] `https://search-the-fox.com/results`
  - [x] `https://search-the-fox.com/notifications` (if auth redirects there)
- [x] Keep old URLs temporarily during migration:
  - [x] `https://searching-the-fox.vercel.app/auth/callback`
  - [x] `https://searching-the-fox.vercel.app/` (etc.)
- [x] Click **Save**

### C. Test Auth Flows

After updating Vercel and Supabase:

- [X] Test new user sign-up flow
- [x] Test email confirmation link (check that it redirects to `https://search-the-fox.com/...`)
- [x] Test login flow
- [ ] Test password reset flow
- [x] Test logout

### D. Clean Up Old URLs (After Stable Period)

After 1-2 weeks with no issues:

- [ ] Remove old Vercel domain URLs from Supabase Redirect URLs:
  - [ ] Remove `https://searching-the-fox.vercel.app/auth/callback`
  - [ ] Remove other `.vercel.app` entries

---

## 4. Google OAuth (and Other Auth Providers)

Update OAuth redirect URIs in Google Cloud Console:

- [x] Log in to Google Cloud Console: https://console.cloud.google.com
- [x] Select your project
- [x] Go to **APIs & Services** → **Credentials**
- [x] Find your OAuth 2.0 Client ID (used for Supabase auth)
- [x] Click to edit

### A. Update Authorized JavaScript Origins

- [x] Add: `https://search-the-fox.com`
- [x] Keep temporarily: `https://searching-the-fox.vercel.app` (for rollback safety)

### B. Update Authorized Redirect URIs

- [ ] Confirm Supabase redirect URI is present (usually managed by Supabase):
  - Format: `https://<your-supabase-project>.supabase.co/auth/v1/callback`
- [ ] If you have direct domain redirects, update them:
  - Add: `https://search-the-fox.com/auth/callback` (if used directly)
  - Keep old during migration: `https://searching-the-fox.vercel.app/auth/callback`

### C. Save Changes

- [x] Click **Save**
- [x] Test Google OAuth login flow from `https://search-the-fox.com`

### D. Other Providers (if applicable)

If you use GitHub, Facebook, or other OAuth providers:

- [ ] **GitHub OAuth App:**
  - [ ] Update **Authorization callback URL** to include `https://search-the-fox.com/auth/callback`
- [ ] **Facebook Login:**
  - [ ] Update **Valid OAuth Redirect URIs**
- [ ] Repeat similar updates for any other providers

### E. Clean Up (After Stable Period)

- [ ] Remove `https://searching-the-fox.vercel.app` from Google OAuth origins
- [ ] Remove old URLs from other providers

---

## 5. Resend (Email Domain & Sender)

Configure email sending from your new domain:

- [x] Log in to Resend dashboard: https://resend.com
- [x] Go to **Domains**

### A. Add and Verify Domain

- [ ] Click **Add Domain**
- [ ] Enter your sending domain:
  - Option 1: `search-the-fox.com` (root domain)
  - Option 2: `mail.search-the-fox.com` (subdomain, recommended for email)
- [ ] Resend will provide DNS records (TXT, CNAME, possibly MX)
- [ ] Add these DNS records in Cloudflare:
  - [ ] Copy each record type, name, and value
  - [ ] Go to Cloudflare → DNS → Add Record
  - [ ] Add all required records exactly as shown
- [ ] Return to Resend and click **Verify Domain**
- [ ] Wait for verification (usually a few minutes, check status)
- [ ] Confirm status shows as **Verified**

### B. Update Sender Identity

- [ ] In Resend, go to your API key or sender settings
- [ ] Update default sender to:
  - `noreply@search-the-fox.com` (or `noreply@mail.search-the-fox.com`)
- [ ] Note: code already updated in `src/lib/email/emailService.ts` comment

### C. Test Email Sending

After Vercel redeploy with new domain:

- [ ] Trigger a test email from the app
- [ ] Check your inbox (and spam folder)
- [ ] Confirm email arrives with correct sender domain
- [ ] Verify all links in email point to `https://search-the-fox.com/...`

---

## 6. Render (JobSpy API - CORS)

Update CORS allowed origins on your Render service:

- [x] Log in to Render dashboard: https://dashboard.render.com
- [x] Select your service: `truelist-jobspy-api` (or similar)
- [x] Go to **Environment** (or wherever CORS is configured)

### A. Update Allowed Origins

If CORS is enforced via environment variables or code:

- [ ] Add `https://search-the-fox.com` to allowed origins
- [ ] Keep `https://searching-the-fox.vercel.app` during migration
- [ ] If using an env var like `ALLOWED_ORIGINS`, update its value:
  - Example: `ALLOWED_ORIGINS=https://search-the-fox.com,https://searching-the-fox.vercel.app`

### B. Redeploy (if needed)

- [ ] If you changed environment variables, trigger a redeploy
- [ ] Wait for service to restart

### C. Test API Calls

- [ ] From `https://search-the-fox.com`, perform a job search
- [ ] Confirm API calls succeed (check browser console for CORS errors)
- [ ] Verify jobs are returned and saved

### D. Clean Up (After Stable Period)

- [ ] Remove `https://searching-the-fox.vercel.app` from allowed origins

---

## 7. Verification & Testing

After completing all external service updates:

### A. Functional Testing

- [ ] Visit `https://search-the-fox.com`
- [ ] Verify site loads correctly
- [ ] Test job search functionality
- [ ] Test saved searches / notifications UI
- [ ] Test email notification trigger (manual or scheduled)
- [ ] Verify all emails:
  - [ ] Arrive in inbox
  - [ ] Have correct sender: `noreply@search-the-fox.com`
  - [ ] All links point to `https://search-the-fox.com/...`

### B. Auth & Security Testing

- [ ] New user sign-up
- [ ] Email confirmation (check redirect to new domain)
- [ ] Login with existing account
- [ ] Password reset flow
- [ ] Google OAuth login (if enabled)
- [ ] Logout

### C. SEO & Redirects

- [ ] Visit `https://searching-the-fox.vercel.app/` and confirm 301 redirect to `https://search-the-fox.com/`
- [ ] Visit `https://searching-the-fox.vercel.app/results` and confirm redirect preserves path
- [ ] Check canonical URL in page source: should be `https://search-the-fox.com/`
- [ ] Verify Open Graph meta tags use new domain

### D. Search Console & Analytics (Optional)

- [ ] Add `https://search-the-fox.com` to Google Search Console
- [ ] Verify domain ownership (via DNS TXT record in Cloudflare)
- [ ] Submit sitemap (if you have `/sitemap.xml`)
- [ ] Request reindex of key pages
- [ ] Update Google Analytics property URL (if used)

---

## 8. Post-Migration Monitoring

After migration is complete and stable (1-2 weeks):

### A. Monitor for Issues

- [ ] Check Vercel deployment logs for errors
- [ ] Check Render API logs for CORS issues
- [ ] Check Supabase auth logs for redirect problems
- [ ] Check Resend email delivery rates

### B. Clean Up Old Domain References

- [ ] In Supabase: remove old `.vercel.app` redirect URLs
- [ ] In Google OAuth: remove old authorized origins
- [ ] In Render: remove old CORS origins
- [ ] In GitHub, Facebook, or other OAuth providers: remove old redirect URLs

### C. Update Documentation (Optional)

- [ ] Update any internal documentation or wikis
- [ ] Update team communication (Slack, email) about new domain
- [ ] Update any external references (blog posts, social media) if applicable

---

## Quick Reference

- **Old domain:** `https://searching-the-fox.vercel.app`
- **New domain:** `https://search-the-fox.com`
- **Key env variable:** `NEXT_PUBLIC_SITE_URL=https://search-the-fox.com`
- **Email sender:** `noreply@search-the-fox.com` (or `noreply@mail.search-the-fox.com`)

---

## Rollback Plan (If Needed)

If critical issues arise:

1. **Vercel:**
   - [ ] Remove `search-the-fox.com` as primary domain
   - [ ] Set `searching-the-fox.vercel.app` back as primary
   - [ ] Update `NEXT_PUBLIC_SITE_URL` back to old domain
   - [ ] Redeploy

2. **Supabase:**
   - [ ] Change Site URL back to `https://searching-the-fox.vercel.app`

3. **Resend:**
   - [ ] Revert sender to `onboarding@resend.dev` temporarily

4. **Render:**
   - [ ] Ensure old domain is still in CORS allowed origins

---

**Migration Status:** In Progress

**Last Updated:** December 11, 2025
