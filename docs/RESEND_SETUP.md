# Phase 2 - Email Service Setup

## Resend Setup Instructions

### 1. Install Resend Package

Run this command in your terminal:

```bash
npm install resend
```

### 2. Get Your Resend API Key

1. Go to https://resend.com/
2. Sign in to your account
3. Navigate to **API Keys** section
4. Create a new API key (or copy your existing one)
5. Copy the API key (starts with `re_...`)

### 3. Add Environment Variable

Add your Resend API key to your environment variables:

**For local development** - Add to `.env.local`:
```
RESEND_API_KEY=re_your_api_key_here
```

**For Vercel deployment** - Add in Vercel Dashboard:
1. Go to your project settings
2. Navigate to **Environment Variables**
3. Add variable:
   - Name: `RESEND_API_KEY`
   - Value: `re_your_api_key_here`

### 4. Verify Your Domain (Optional but Recommended)

By default, Resend allows sending from `onboarding@resend.dev` for testing.

For production emails:
1. In Resend dashboard, go to **Domains**
2. Add your domain (e.g., `searching-the-fox.vercel.app`)
3. Add the DNS records they provide to your domain
4. Wait for verification (usually takes a few minutes)

Once verified, you can send from `noreply@yourdomain.com` instead of the test domain.

### 5. Update Email Configuration (After Domain Verification)

Once your domain is verified, update the `from` email in:
- `src/lib/email/emailService.ts` - change `SENDER_EMAIL` constant

---

## Testing

After setup, you can test by:
1. Going to `/notifications` page
2. Clicking "Send Test Email" button
3. Check your email inbox for the test email

---

## Rate Limits (Free Tier)

- **100 emails/day** on free tier
- **3,000 emails/month** on free tier
- Upgrade to paid plan for higher limits

---

## What I've Built

1. ✅ Email service using Resend (`src/lib/email/emailService.ts`)
2. ✅ Server-side HTML renderer for email template (`src/lib/email/renderEmailTemplate.ts`)
3. ✅ API endpoint to send test email (`src/app/api/notifications/send-test/route.ts`)
4. ✅ "Send Test Email" button in notifications page
5. ✅ Email subject includes job count (e.g., "5 New Jobs Matching Your Criteria")
