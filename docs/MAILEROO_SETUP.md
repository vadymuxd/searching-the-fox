# Maileroo Email Service Setup Guide

This guide walks you through migrating from Resend to Maileroo for email notifications in Searching The Fox.

## Why Maileroo?

- **Better template control**: More flexibility in managing email templates
- **Free tier friendly**: Suitable for multiple applications on the free tier
- **Reliable delivery**: Professional SMTP service with good deliverability

## Prerequisites

1. A Maileroo account (sign up at https://maileroo.com)
2. A verified domain (or use Maileroo's test domain initially)

## Setup Steps

### 1. Create Maileroo Account

1. Go to https://maileroo.com
2. Sign up for a free account
3. Verify your email address

### 2. Get API Key

1. Log in to your Maileroo dashboard
2. Navigate to **Settings** → **API Keys**
3. Click **Create API Key**
4. Give it a name (e.g., "Searching The Fox")
5. Copy the generated API key (you'll need this for environment variables)

### 3. Verify Your Domain (Optional but Recommended)

For production use, you should verify your domain:

1. In Maileroo dashboard, go to **Settings** → **Domains**
2. Click **Add Domain**
3. Enter your domain (e.g., `searching-the-fox.com`)
4. Follow the DNS configuration instructions:
   - Add the provided SPF record
   - Add the provided DKIM record
   - Add the provided DMARC record (optional but recommended)
5. Wait for DNS propagation (can take up to 48 hours)
6. Click **Verify** once DNS records are in place

**For testing**, you can use Maileroo's default sending domain initially.

### 4. Configure Environment Variables

#### For Next.js Frontend (Vercel/Local)

Add to your `.env.local` file:

```bash
# Remove or comment out old Resend key
# RESEND_API_KEY=re_xxxxx

# Add Maileroo API key
MAILEROO_API_KEY=your_maileroo_api_key_here
```

#### For Python Backend (Render/Local)

Add to your Render environment variables or `.env` file:

```bash
# Remove or comment out old Resend key
# RESEND_API_KEY=re_xxxxx

# Add Maileroo API key
MAILEROO_API_KEY=your_maileroo_api_key_here
```

### 5. Update Sender Email

Update the sender email in both services to match your verified domain:

#### In `jobspy-service/email_service.py`:
```python
SENDER_EMAIL = 'noreply@your-domain.com'  # Change to your verified domain
SENDER_NAME = 'Searching The Fox'
```

#### In `src/lib/email/emailService.ts`:
```typescript
const SENDER_EMAIL = 'noreply@your-domain.com'; // Change to your verified domain
const SENDER_NAME = 'Searching The Fox';
```

**Note**: If you haven't verified a domain yet, you can use Maileroo's test address for initial testing.

### 6. Install Dependencies

#### For Python Service:

```bash
cd jobspy-service
pip install -r requirements.txt
```

The `resend` package has been removed and replaced with the standard `requests` library (already included).

#### For Next.js Frontend:

```bash
npm install
```

The `resend` npm package has been removed from dependencies.

### 7. Test the Integration

#### Test from Frontend:

1. Start your Next.js application
2. Log in to your account
3. Go to the Notifications page
4. Click **"Send Test Email"**
5. Check your inbox for the test email

#### Test from Python Service:

You can test the Python email service directly:

```bash
cd jobspy-service
python -c "
from email_service import send_job_email
result = send_job_email(
    to='your-test-email@example.com',
    jobs=[],
    user_name='Test User'
)
print(result)
"
```

## Deployment

### Vercel (Next.js Frontend)

1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Remove `RESEND_API_KEY`
4. Add `MAILEROO_API_KEY` with your Maileroo API key
5. Redeploy your application

### Render (Python Backend)

1. Go to your Render service dashboard
2. Navigate to **Environment** tab
3. Remove `RESEND_API_KEY`
4. Add `MAILEROO_API_KEY` with your Maileroo API key
5. Save changes (this will trigger automatic redeployment)

## Email Templates

Maileroo provides a template editor in the dashboard:

1. Go to **Templates** in your Maileroo dashboard
2. Create and customize your email templates
3. You can use variables like `{{job_count}}`, `{{user_name}}`, etc.

Currently, the application uses HTML templates rendered in code. You can migrate to Maileroo's template system later if desired.

## Monitoring and Analytics

Maileroo provides email analytics:

1. Go to **Reports** in your Maileroo dashboard
2. View:
   - Emails sent
   - Delivery rates
   - Bounce rates
   - Open rates (if tracking is enabled)

## Troubleshooting

### Email Not Sending

1. **Check API Key**: Ensure `MAILEROO_API_KEY` is set correctly in your environment
2. **Check Logs**: 
   - For Next.js: Check Vercel logs or local console
   - For Python: Check Render logs or terminal output
3. **Verify Domain**: Ensure your sender domain is verified in Maileroo

### "Email service is not configured" Error

This means the `MAILEROO_API_KEY` environment variable is not set or not accessible. Double-check:
- The variable name is exactly `MAILEROO_API_KEY`
- It's set in the correct environment (production/development)
- You've redeployed after adding the variable

### Emails Going to Spam

1. Verify your domain with SPF, DKIM, and DMARC records
2. Use a professional sender email (e.g., `noreply@your-domain.com`)
3. Avoid spam trigger words in subject lines
4. Maintain good sending practices (don't send too frequently)

## API Rate Limits

Maileroo free tier includes:
- **1,000 emails/month** for free
- Check your current plan limits in the dashboard

For higher volume, consider upgrading to a paid plan.

## Migration Checklist

- [ ] Created Maileroo account
- [ ] Generated API key
- [ ] Verified domain (optional for testing)
- [ ] Updated environment variables (Vercel)
- [ ] Updated environment variables (Render)
- [ ] Updated sender email in code
- [ ] Removed old Resend dependencies
- [ ] Tested email from frontend
- [ ] Tested email from Python service
- [ ] Monitored first production emails
- [ ] Removed old Resend API keys from all platforms

## Support

- **Maileroo Documentation**: https://maileroo.com/docs
- **Maileroo Support**: support@maileroo.com
- **API Reference**: https://maileroo.com/docs/api

## Rollback Plan

If you need to rollback to Resend:

1. Re-add `resend` dependencies to `package.json` and `requirements.txt`
2. Restore the old code from git history
3. Update environment variables back to `RESEND_API_KEY`
4. Redeploy both services

However, the Maileroo integration is simpler and more flexible, so rollback should not be necessary.
