# Email Notifications Feature - Implementation Guide

## Phase 1: Subscription Function ✅ COMPLETED

### Changes Made:

#### 1.1 AuthButton Component
- ✅ Added "Notifications" menu item with bell icon
- ✅ Redirects to `/notifications` page when clicked
- **File:** `src/components/AuthButton.tsx`

#### 1.2 Notifications Page
- ✅ Created `/notifications` page with Mantine UI
- ✅ Simple toggle switch for email notifications
- ✅ Shows current subscription status
- ✅ Displays explanatory text about how it works
- **File:** `src/app/notifications/page.tsx`

#### 1.3 Database Changes
- ✅ Created SQL migration script
- ✅ Adds `email_notifications_enabled` column (BOOLEAN, default FALSE)
- ✅ Creates index for performance
- **File:** `docs/004_add_email_notifications.sql`

### Database Migration Required:

Run this SQL in your Supabase SQL Editor:

```sql
-- Add email_notifications_enabled column to users table
ALTER TABLE users 
ADD COLUMN email_notifications_enabled BOOLEAN DEFAULT FALSE;

-- Create index for faster queries
CREATE INDEX idx_users_email_notifications_enabled 
ON users(email_notifications_enabled) 
WHERE email_notifications_enabled = TRUE;

-- Add comment
COMMENT ON COLUMN users.email_notifications_enabled IS 'Whether user has opted in to receive email notifications about new jobs';
```

### API Endpoints Created:

#### `GET /api/notifications/settings`
- Fetches current notification settings for authenticated user
- Returns: `{ success: true, emailNotificationsEnabled: boolean }`

#### `POST /api/notifications/settings`
- Updates notification settings
- Body: `{ emailNotificationsEnabled: boolean }`
- Returns: `{ success: true, emailNotificationsEnabled: boolean }`

---

## Phase 1 Testing Checklist:

### ✅ UI Testing:
1. Sign in to your account
2. Click on your account menu (top right)
3. Verify "Notifications" menu item appears (with bell icon)
4. Click "Notifications" - should navigate to `/notifications`
5. Page should show:
   - Title: "Notification Settings"
   - Toggle switch labeled "Email Notifications"
   - Description text
   - Info box explaining how it works

### ✅ Toggle Testing:
1. Toggle the switch ON
   - Should see green success notification
   - Toggle should stay ON
   - Should see blue checkmark text "✓ You will receive email notifications for new jobs"
2. Refresh the page
   - Toggle should remain ON (persisted)
3. Toggle the switch OFF
   - Should see green success notification
   - Toggle should be OFF
   - Checkmark text should disappear
4. Refresh again
   - Toggle should remain OFF

### ✅ Backend Testing:
1. **In Supabase Dashboard:**
   - Go to Table Editor → users
   - Find your user row
   - Check `email_notifications_enabled` column
   - Should be `true` when toggled ON, `false` when OFF

2. **Using API directly (optional):**
   ```bash
   # Get settings
   curl -X GET http://localhost:3000/api/notifications/settings \
     -H "Cookie: your-session-cookie"
   
   # Update settings
   curl -X POST http://localhost:3000/api/notifications/settings \
     -H "Content-Type: application/json" \
     -H "Cookie: your-session-cookie" \
     -d '{"emailNotificationsEnabled": true}'
   ```

### Expected Results:
- ✅ Toggle changes are saved to database immediately
- ✅ Toggle state persists across page refreshes
- ✅ Success/error notifications appear appropriately
- ✅ Page requires authentication (redirects to home if not logged in)

---

## Phase 2: Email Service Provider ✅ COMPLETED

### Changes Made:

#### 2.1 Email Service Integration
- ✅ Created email service using Resend (`src/lib/email/emailService.ts`)
- ✅ Server-side email template renderer (`src/lib/email/renderEmailTemplate.ts`)
- ✅ Uses same HTML template as `/email-template` page
- ✅ Supports single and bulk email sending

#### 2.2 Email Subject with Job Count
- ✅ Subject line includes number of jobs: `"5 New Jobs Matching Your Criteria"`
- ✅ Handles edge cases: `"1 New Job Matching Your Criteria"` or `"No New Jobs This Time"`

#### 2.3 Email Content from Database
- ✅ Fetches NEW jobs filtered by user's keywords
- ✅ Renders full HTML email with job cards
- ✅ Includes company logo, job title, description, location, etc.
- ✅ Clickable "View Job Post" buttons

#### 2.4 Send Test Email Feature
- ✅ Added "Send Test Email" button in `/notifications` page
- ✅ API endpoint: `POST /api/notifications/send-test`
- ✅ Sends email to authenticated user's email address
- ✅ Shows success notification with job count
- **File:** `src/app/api/notifications/send-test/route.ts`

### Resend Setup Required:

#### Step 1: Install Resend Package

```bash
npm install resend
```

#### Step 2: Get Your Resend API Key

1. Go to https://resend.com/
2. Sign in (or create account)
3. Navigate to **API Keys**
4. Create/copy API key (starts with `re_...`)

#### Step 3: Add Environment Variable

**Local Development** - Create/update `.env.local`:
```
RESEND_API_KEY=re_your_api_key_here
```

**Vercel Deployment** - Add in Vercel Dashboard:
1. Project Settings → Environment Variables
2. Name: `RESEND_API_KEY`
3. Value: `re_your_api_key_here`

#### Step 4: Domain Verification (Optional)

**Default:** Emails send from `onboarding@resend.dev` (for testing)

**Production:** Verify your domain in Resend:
1. Add domain in Resend dashboard
2. Add DNS records
3. Update `SENDER_EMAIL` in `src/lib/email/emailService.ts`

---

## Phase 2 Testing Checklist:

### ✅ Setup Testing:
1. Install resend package: `npm install resend`
2. Add `RESEND_API_KEY` to `.env.local`
3. Restart dev server

### ✅ Send Test Email:
1. Navigate to `/notifications` page
2. Ensure you have keywords set up
3. Ensure you have some NEW jobs in database
4. Click "Send Test Email" button
5. Should see success notification
6. Check your email inbox (may take 1-2 minutes)

### ✅ Verify Email Content:
1. Email subject shows job count
2. Email has clickable logo linking to results page
3. Each job card shows:
   - Company logo/initial
   - Company name
   - Job title
   - Location
   - Job type, remote status, salary
   - "View Job Post" button
4. Footer includes unsubscribe info

### ✅ Edge Cases:
1. **No keywords:** Should show error message
2. **No NEW jobs:** Email should say "No new jobs found"
3. **Invalid API key:** Should show configuration error

---

## Files Created/Modified:

### Created:
- `src/lib/email/emailService.ts` - Resend integration
- `src/lib/email/renderEmailTemplate.ts` - HTML renderer
- `src/app/api/notifications/send-test/route.ts` - Test email API
- `docs/RESEND_SETUP.md` - Setup instructions

### Modified:
- `src/app/notifications/page.tsx` - Added "Send Test Email" button

---

## Phase 3: Automation (NEXT)

Will implement:
- CRON job integration
- Automatic email sending after job scraping
- Python script updates on Render
- Multi-user email dispatch

---

## Phase 3: Automation (FUTURE)

Will implement:
- CRON job integration
- Automatic email sending after job scraping
- Multi-user email dispatch

---

## Files Modified/Created:

### Modified:
- `src/components/AuthButton.tsx` - Added Notifications menu item

### Created:
- `src/app/notifications/page.tsx` - Notifications settings page
- `src/app/api/notifications/settings/route.ts` - API endpoint
- `docs/004_add_email_notifications.sql` - Database migration

### Database Schema:
- `users.email_notifications_enabled` - BOOLEAN (default: false)
