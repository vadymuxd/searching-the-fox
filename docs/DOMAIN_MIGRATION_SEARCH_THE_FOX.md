# Domain Migration Guide

**Project:** `searching-the-fox`

**Old primary domain:** `https://searching-the-fox.vercel.app`

**New primary domain:** `https://search-the-fox.com`

This document describes how to migrate the production site from the Vercel default domain to a custom domain, update SEO and email behavior, and adjust all related third‑party services.

Use this as the single source of truth during migration.

---

## 1. Goals & Scope

- [ ] Make `https://search-the-fox.com` the canonical production URL.
- [ ] Preserve SEO by using 301 redirects and proper metadata.
- [ ] Ensure Supabase auth, password reset, and email confirmation work on the new domain.
- [ ] Ensure Resend emails use the new domain in links and sender.
- [ ] Ensure Render (jobspy API) works correctly when called from the new origin.
- [ ] Keep `searching-the-fox.vercel.app` only as a redirect source.

Out of scope: renaming the repository or changing the app’s product name (“Searching The Fox”), unless explicitly desired later.

---

## 2. Canonical Values

These are the key values you will converge to across code, envs, and services.

- **Canonical site URL (public):**
  - `https://search-the-fox.com`
- **Local dev site URL:**
  - `http://localhost:3000`
- **Env variable for site URL:**
  - `NEXT_PUBLIC_SITE_URL`
    - **Production:** `https://search-the-fox.com`
    - **Development:** `http://localhost:3000`
- **Email sender domain (Resend):**
  - Prefer: `noreply@search-the-fox.com` or `noreply@mail.search-the-fox.com` (depending on Resend/Cloudflare DNS setup).

---

## 3. Internal Code & Config Changes

This section lists all code/config locations impacted by the domain change.

### 3.1 SEO & Metadata

**File:** `src/app/layout.tsx`

- [x] Add a `metadataBase` using `NEXT_PUBLIC_SITE_URL` as the canonical base:
  - Example intent (implementation will follow later):
    - Use `metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://search-the-fox.com')`.
- [x] Optionally add canonical URLs via `alternates.canonical` so that `/` resolves to `https://search-the-fox.com/`.
- [x] Keep the existing `title`, `description`, `openGraph`, and `robots` but ensure they do **not** mention `searching-the-fox.vercel.app` anywhere.
- [x] Confirm that icons/OG images (e.g. `/favicon.png`) will resolve under the new domain via `metadataBase`.

### 3.2 Email Templates and Links

**File:** `src/lib/email/renderEmailTemplate.ts`

- [x] Replace absolute links using the old domain:
  - `https://searching-the-fox.vercel.app/results`
  - `https://searching-the-fox.vercel.app/favicon.png`
- [x] New target values:
  - `https://search-the-fox.com/results`
  - `https://search-the-fox.com/favicon.png`
- [ ] (Optional hardening) Derive base URL from `process.env.NEXT_PUBLIC_SITE_URL` instead of hardcoding the domain.

**File:** `src/app/email-template/page.tsx`

- [x] Update `href="https://searching-the-fox.vercel.app/results"` to use the new domain or `NEXT_PUBLIC_SITE_URL`.

### 3.3 Email Service Configuration

**File:** `src/lib/email/emailService.ts`

- [x] Update comments that reference `noreply@searching-the-fox.vercel.app` to `noreply@search-the-fox.com` (or the chosen sending domain).
- [x] Confirm any actual `from:` addresses used in email sending logic are consistent with the new verified Resend domain.
- [x] Keep environment variable usage `RESEND_API_KEY` as-is; only the domain/sender identity changes.

### 3.4 Auth & Redirect URLs

**File:** `src/lib/auth/actions.ts`

- [ ] Confirm that password reset links use `NEXT_PUBLIC_SITE_URL`:
  - `redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/reset-password``
- [ ] After env changes (Section 4), verify that in production this resolves to:
  - `https://search-the-fox.com/auth/reset-password`.
- [ ] (Optional) In the future, consider removing the `localhost` fallback in production environments.

### 3.5 Environment Files Inside the Repo

**Files:**
- `.env.local`
- `.env.production`

> Note: these files currently contain real credentials. Over time, consider removing them from git and relying on Vercel/Render/Supabase env management.

- [x] In `.env.local`, add or update:
  - `NEXT_PUBLIC_SITE_URL=http://localhost:3000`
- [x] In `.env.production`, add or update:
  - `NEXT_PUBLIC_SITE_URL=https://search-the-fox.com`
- [ ] Ensure no secrets are accidentally committed in future changes (consider `.gitignore` hardening or environment-only secrets).

### 3.6 Documentation Mentions of Old Domain

These do not affect runtime behavior but must be updated so future operations are correct.

**Files to update:**

- `docs/LOCAL_DEVELOPMENT.md`
  - [x] Replace production URL: `https://searching-the-fox.vercel.app` → `https://search-the-fox.com`.

- `docs/VERCEL_DEPLOYMENT_GUIDE.md`
  - [ ] Update all example URLs:
    - `https://searching-the-fox.vercel.app` or `https://searching-the-fox-xxxx.vercel.app` → `https://search-the-fox.com` where appropriate.
  - [ ] Clarify that `NEXT_PUBLIC_SITE_URL` in Vercel should be set to the custom domain `https://search-the-fox.com`.

- `docs/POST_DEPLOYMENT_SETUP.md`
  - [ ] Replace sample domains like `https://searching-the-fox-xxxxx.vercel.app` with `https://search-the-fox.com` when referring to the canonical production site.
  - [ ] Adjust steps that mention updating `NEXT_PUBLIC_SITE_URL` to clearly point to `https://search-the-fox.com`.

- `docs/RESEND_SETUP.md`
  - [x] Change examples from `searching-the-fox.vercel.app` to `search-the-fox.com` (or the designated email sending subdomain).

- `docs/PHASE_3_EMAIL_AUTOMATION.md`
  - [x] Update URLs in instructions:
    - `https://searching-the-fox.vercel.app/notifications` → `https://search-the-fox.com/notifications`
    - `curl -X POST https://searching-the-fox.vercel.app/api/cron/trigger-search` → `curl -X POST https://search-the-fox.com/api/cron/trigger-search`

- `docs/AUTH_FLOW_FIXED.md`
  - [x] Update Supabase auth URLs:
    - `https://searching-the-fox.vercel.app/` → `https://search-the-fox.com/`
    - `/auth/callback` → `https://search-the-fox.com/auth/callback`
    - `/results` → `https://search-the-fox.com/results`
    - `/auth/error` → `https://search-the-fox.com/auth/error`

- `docs/EMAIL_CONFIRMATION_SETUP.md`
  - [x] Update:
    - `https://searching-the-fox.vercel.app/auth/callback/confirm` → `https://search-the-fox.com/auth/callback/confirm`
    - `https://searching-the-fox.vercel.app/auth/callback` → `https://search-the-fox.com/auth/callback`
    - `https://searching-the-fox.vercel.app/` → `https://search-the-fox.com/`

- `docs/PHASE_3_DEPLOYMENT_CHECKLIST.md`
  - [x] Update any references to the old domain (notifications page, cron URL, etc.) to use `https://search-the-fox.com`.

- `docs/EMAIL_TEMPLATE_FEATURE.md`
  - [x] Update description:
    - `Clickable logo linking to https://searching-the-fox.vercel.app/results` → `https://search-the-fox.com/results`.

- `docs/PRE_DEPLOYMENT_CHECKLIST.md`
  - [ ] Where the document instructs to set `NEXT_PUBLIC_SITE_URL` to a Vercel domain, revise to set it to the custom domain for production.

(Any additional docs containing `searching-the-fox.vercel.app` should be updated similarly.)

### 3.7 Optional: Package Name

**Files:**
- `package.json`
- `package-lock.json`

- [ ] Decide whether you want to keep the npm package name `"searching-the-fox"`. This is independent of the domain and safe to leave unchanged.

---

## 4. Environment Variables & Infrastructure

### 4.1 Vercel Environment Variables

In Vercel project **Settings → Environment Variables** for `searching-the-fox`:

- [ ] Set or update `NEXT_PUBLIC_SITE_URL`:
  - **Production:** `https://search-the-fox.com`
  - **Preview:** `https://search-the-fox.com` (or a preview-specific value if you prefer).
- [ ] Redeploy once this is updated, so all server actions (e.g., Supabase password reset) use the new domain.

### 4.2 Vercel Domains & Redirects

In Vercel project **Settings → Domains**:

- [ ] Attach the new domain `search-the-fox.com`.
- [ ] Follow Vercel’s instructions to configure Cloudflare DNS:
  - Add `CNAME` (or `A` record) so `search-the-fox.com` points to Vercel.
  - Optionally add `www.search-the-fox.com` and configure redirects to apex.
- [ ] Set `search-the-fox.com` as the **Primary** domain.
- [ ] Keep `searching-the-fox.vercel.app` attached as a secondary domain.
- [ ] Configure 301 redirects (via Vercel UI or `next.config.*`):
  - From: `https://searching-the-fox.vercel.app/*`
  - To: `https://search-the-fox.com/:path*`
  - Status: **301 Permanent**.

### 4.3 Cloudflare DNS & SSL

In Cloudflare for `search-the-fox.com`:

- [ ] Add DNS records per Vercel’s instructions:
  - Typically `CNAME search-the-fox.com` → `cname.vercel-dns.com` (exact target from Vercel).
  - Similarly for `www.search-the-fox.com` if used.
- [ ] Ensure TLS/SSL is set to **Full** or **Full (strict)**.
- [ ] Confirm that the Cloudflare proxy status (orange cloud) is compatible with Vercel’s recommendations.

### 4.4 Supabase Configuration

In Supabase dashboard:

- **Authentication → URL Configuration**
  - [ ] Set **Site URL** to:
    - `https://search-the-fox.com`
  - [ ] Update **Redirect URLs / Allowed Redirect URLs** to include:
    - `https://search-the-fox.com/auth/callback`
    - `https://search-the-fox.com/auth/callback/confirm`
    - `https://search-the-fox.com/auth/error`
    - `https://search-the-fox.com/results`
    - Any other final destinations used by auth flows (e.g., `/` or `/notifications` if Supabase ever redirects there).
  - [ ] Keep existing `https://searching-the-fox.vercel.app/...` entries temporarily during migration, then remove when confident.

- **Database / API keys**
  - No changes required: `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL` point to the Supabase project, which is independent of the front-end domain.

### 4.5 Google OAuth (and other providers)

In Google Cloud Console, for the OAuth client used by Supabase (or the app directly):

- [ ] Under **Authorized JavaScript origins**:
  - Add: `https://search-the-fox.com`.
  - Keep: `https://searching-the-fox.vercel.app` during the migration window.
- [ ] Under **Authorized redirect URIs**:
  - If any direct redirects point to your domain, update them to `https://search-the-fox.com/...`.
  - If Supabase manages redirects, ensure its callback URL remains correct and unchanged.

Repeat similar steps for other providers (GitHub, etc.) if configured, updating any redirect or origin URLs that reference the old domain.

### 4.6 Resend (Email)

In Resend dashboard:

- [ ] Add sending domain:
  - `search-the-fox.com` or `mail.search-the-fox.com`.
- [ ] Add the required DNS records in Cloudflare (TXT, CNAME, MX) and wait for verification.
- [ ] Create/update a sender identity (e.g., `noreply@search-the-fox.com`).
- [ ] Update code and docs:
  - `src/lib/email/emailService.ts` → use the new sender.
  - `docs/RESEND_SETUP.md`, `docs/EMAIL_NOTIFICATIONS_IMPLEMENTATION.md`, `docs/PHASE_3_EMAIL_AUTOMATION.md` → reflect new sender and domain.
- [ ] Ensure `RESEND_API_KEY` remains valid and consistent across Vercel and Render environments.

### 4.7 Render (jobspy API)

On Render for the `truelist-jobspy-api.onrender.com` service:

- [ ] If CORS is enforced, add `https://search-the-fox.com` as an allowed origin.
- [ ] Keep `https://searching-the-fox.vercel.app` during migration, then remove once traffic fully moves.
- [ ] No code change in this repo is required for the domain migration; just CORS/origin configuration.

---

## 5. End-to-End Rollout Checklist

Use this as a step-by-step migration sequence.

### 5.1 Pre-Migration Prep (Local + Repo)

- [ ] Ensure `main` is up-to-date locally.
- [x] Implement code changes in:
  - [x] `src/app/layout.tsx` (metadataBase + optional canonical).
  - [x] `src/lib/email/renderEmailTemplate.ts` (links and logo src).
  - [x] `src/app/email-template/page.tsx` (template preview link).
  - [x] `src/lib/email/emailService.ts` (from address/comment).
- [x] Update `.env.local`:
  - [x] Add `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
- [x] Update `.env.production`:
  - [x] Add `NEXT_PUBLIC_SITE_URL=https://search-the-fox.com`.
- [x] Update documentation references (Section 3.6), at least the most critical guides:
  - [x] `docs/LOCAL_DEVELOPMENT.md`
  - [ ] `docs/VERCEL_DEPLOYMENT_GUIDE.md`
  - [ ] `docs/POST_DEPLOYMENT_SETUP.md`
  - [x] `docs/AUTH_FLOW_FIXED.md`
  - [x] `docs/EMAIL_CONFIRMATION_SETUP.md`
  - [x] `docs/RESEND_SETUP.md`
  - [x] `docs/PHASE_3_EMAIL_AUTOMATION.md`
  - [x] `docs/PHASE_3_DEPLOYMENT_CHECKLIST.md`
  - [x] `docs/EMAIL_TEMPLATE_FEATURE.md`

### 5.2 Configure External Services (Before Switching Traffic)

- **Supabase**
  - [ ] Set Site URL to `https://search-the-fox.com`.
  - [ ] Add new Redirect URLs for:
    - [ ] `/auth/callback`
    - [ ] `/auth/callback/confirm`
    - [ ] `/auth/error`
    - [ ] `/results`

- **Resend**
  - [ ] Verify sending domain `search-the-fox.com` or `mail.search-the-fox.com`.
  - [ ] Create sender `noreply@…` on this domain.

- **Google OAuth & Other Providers**
  - [ ] Add `https://search-the-fox.com` to Authorized JavaScript origins.
  - [ ] Update any domain-based redirect URIs where necessary.

- **Render (jobspy API)**
  - [ ] Add `https://search-the-fox.com` to CORS allowed origins.

### 5.3 Attach Domain & DNS

- **Vercel**
  - [ ] Add `search-the-fox.com` to the `searching-the-fox` project.
  - [ ] Set `search-the-fox.com` as **Primary domain**.

- **Cloudflare**
  - [ ] Configure DNS records for `search-the-fox.com` (and optionally `www`) pointing to Vercel.
  - [ ] Confirm SSL mode is appropriate and certificate shows as active.

### 5.4 Update Vercel Env & Deploy

- [ ] In Vercel, set `NEXT_PUBLIC_SITE_URL=https://search-the-fox.com` (Production & optionally Preview).
- [ ] Trigger a new deployment (by pushing changes or re-deploying latest commit).
- [ ] After deployment, verify:
  - [ ] `https://search-the-fox.com` loads correctly.
  - [ ] Supabase auth flows (sign in, sign up, social login if used).
  - [ ] Email confirmation and password reset flows open pages on `https://search-the-fox.com`.
  - [ ] `NEXT_PUBLIC_SITE_URL` is correctly used in reset/password links.

### 5.5 Add Redirects from Old Domain

- [ ] In Vercel Redirects:
  - [ ] Add 301 redirect `searching-the-fox.vercel.app/*` → `https://search-the-fox.com/:path*`.
  - [ ] Optionally add `www.search-the-fox.com/*` → `https://search-the-fox.com/:path*` if `www` is not canonical.
- [ ] Manually test:
  - [ ] Go to `https://searching-the-fox.vercel.app/` and confirm a 301 to `https://search-the-fox.com/`.
  - [ ] Test a subpage, e.g. `/results`, to confirm `:path*` handling.

### 5.6 QA & Verification

- **Functional**
  - [ ] Perform a job search and verify results.
  - [ ] Test saved searches / notifications UI.
  - [ ] Trigger a test notification email via Resend and confirm all links point to `search-the-fox.com`.

- **Security / Auth**
  - [ ] New sign-up and sign-in flows.
  - [ ] Password reset flow end-to-end.
  - [ ] Email confirmation links.

- **SEO / Indexing**
  - [ ] Add `https://search-the-fox.com` as a property in Google Search Console.
  - [ ] Submit sitemap (if implemented, e.g. `/sitemap.xml`).
  - [ ] Check that canonical URLs resolve to `https://search-the-fox.com/...`.

### 5.7 Post-Migration Cleanup

After a stable period (days/weeks) with no traffic issues:

- [ ] In Supabase, remove old `https://searching-the-fox.vercel.app/...` redirect entries.
- [ ] In Google OAuth and other providers, remove `https://searching-the-fox.vercel.app` from authorized origins.
- [ ] In Render, remove `https://searching-the-fox.vercel.app` from CORS allowed origins if present.
- [ ] Optionally, update historical documentation to mention the old domain only as legacy context.

---

## 6. Quick Reference

- **Primary production URL:** `https://search-the-fox.com`
- **Local dev URL:** `http://localhost:3000`
- **Key env:** `NEXT_PUBLIC_SITE_URL`
- **Auth provider URLs:** Supabase Auth → set Site URL and Redirect URLs to `https://search-the-fox.com/...`
- **Email sender:** via Resend, using a verified domain on `search-the-fox.com`.

This guide should be kept up-to-date as you complete the migration and discover any additional dependencies on the old domain.